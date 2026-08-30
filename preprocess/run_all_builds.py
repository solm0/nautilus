import argparse
import os
import subprocess
import sys
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from shared.manifests import PACKS
from model_setup import ensure_language_models


PREPROCESS_DIR = ROOT_DIR / "preprocess"
STEP_SCRIPTS = (
    ("lemmas", "build_lemmas.py"),
)
CAFFEINATE_ENV_VAR = "NAUTILUS_BUILD_CAFFEINATED"


def timestamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(message: str):
    print(f"[{timestamp()}] {message}", flush=True)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run all preprocess build scripts for selected languages with progress logs.",
    )
    parser.add_argument(
        "--version",
        required=True,
        help="Target pack version, for example 1.1.0",
    )
    parser.add_argument(
        "--lang",
        action="append",
        dest="langs",
        help="Language code to build. Repeat for multiple languages. Defaults to all PACKS languages.",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=1,
        help="How many languages to build in parallel. Recommended: 2 or 3.",
    )
    parser.add_argument(
        "--caffeinate",
        action="store_true",
        help="Run under macOS caffeinate so the machine stays awake during the build.",
    )
    parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help="Continue with the remaining languages even if one language fails.",
    )
    return parser.parse_args()


def resolve_languages(selected_langs: list[str] | None):
    ordered_langs = list(dict.fromkeys(pack["lang"] for pack in PACKS))

    if not selected_langs:
        return ordered_langs

    requested = []
    known = set(ordered_langs)

    for lang in selected_langs:
        if lang not in known:
            raise KeyError(f"Unknown language: {lang}")
        if lang not in requested:
            requested.append(lang)

    return requested


def build_env(version: str):
    env = os.environ.copy()
    env["NAUTILUS_PACK_VERSION"] = version
    return env


def maybe_reexec_with_caffeinate(argv: list[str]):
    if "--caffeinate" not in argv:
        return

    if os.environ.get(CAFFEINATE_ENV_VAR) == "1":
        return

    env = os.environ.copy()
    env[CAFFEINATE_ENV_VAR] = "1"
    filtered_argv = [arg for arg in argv if arg != "--caffeinate"]
    command = ["caffeinate", "-dimsu", sys.executable, *filtered_argv]
    log("Re-launching under caffeinate")
    os.execvpe("caffeinate", command, env)


class StepCounter:
    def __init__(self, total_steps: int):
        self.total_steps = total_steps
        self.current_step = 0
        self._lock = threading.Lock()

    def next(self) -> int:
        with self._lock:
            self.current_step += 1
            return self.current_step


def run_script(
    lang: str,
    step_name: str,
    script_name: str,
    version: str,
    step_counter: StepCounter,
):
    script_path = PREPROCESS_DIR / lang / script_name

    if not script_path.exists():
        raise FileNotFoundError(f"Missing script: {script_path}")

    step_index = step_counter.next()
    log(f"[{step_index}/{step_counter.total_steps}] {lang} {step_name}: start")
    started_at = time.perf_counter()

    process = subprocess.Popen(
        [sys.executable, str(script_path)],
        cwd=ROOT_DIR,
        env=build_env(version),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    assert process.stdout is not None

    for line in process.stdout:
        print(f"[{timestamp()}] [{lang}:{step_name}] {line.rstrip()}", flush=True)

    return_code = process.wait()
    elapsed = time.perf_counter() - started_at

    if return_code != 0:
        raise RuntimeError(
            f"{lang} {step_name} failed with exit code {return_code} after {elapsed:.1f}s"
        )

    log(f"[{step_index}/{step_counter.total_steps}] {lang} {step_name}: done in {elapsed:.1f}s")


def verify_artifacts(lang: str, version: str):
    release_dir = ROOT_DIR / "releases" / lang / f"{lang}-v{version}"
    required_files = [
        release_dir / "lemma_pack.db",
        release_dir / "lemma_manifest.json",
        release_dir / f"{lang}-v{version}-lemma.zip",
    ]

    missing = [path.name for path in required_files if not path.exists()]
    if missing:
        raise FileNotFoundError(
            f"{lang} v{version} is missing expected artifacts: {', '.join(missing)}"
        )

    log(f"{lang} verify: artifacts ready in {release_dir}")


def build_language(lang: str, version: str, step_counter: StepCounter):
    log(f"{lang}: begin")

    for step_name, script_name in STEP_SCRIPTS:
        run_script(lang, step_name, script_name, version, step_counter)

    verify_artifacts(lang, version)
    log(f"{lang}: complete")


def run_parallel(langs: list[str], version: str, jobs: int, continue_on_error: bool):
    total_steps = len(langs) * len(STEP_SCRIPTS)
    step_counter = StepCounter(total_steps)
    failures: list[str] = []

    with ThreadPoolExecutor(max_workers=jobs) as executor:
        pending_langs = list(langs)
        running = {
            executor.submit(build_language, lang, version, step_counter): lang
            for lang in pending_langs[:jobs]
        }
        next_index = len(running)

        while running:
            done, _ = wait(running.keys(), return_when=FIRST_COMPLETED)

            for future in done:
                lang = running.pop(future)

                try:
                    future.result()
                except Exception as exc:
                    failures.append(f"{lang}: {exc}")
                    log(f"{lang}: failed - {exc}")

                    if not continue_on_error:
                        for other in running:
                            other.cancel()
                        return failures

                if next_index < len(pending_langs):
                    next_lang = pending_langs[next_index]
                    running[executor.submit(build_language, next_lang, version, step_counter)] = next_lang
                    next_index += 1

    return failures


def main():
    maybe_reexec_with_caffeinate(sys.argv)

    args = parse_args()
    langs = resolve_languages(args.langs)
    jobs = max(1, args.jobs)
    overall_started_at = time.perf_counter()

    if jobs > 3:
        log("Warning: jobs > 3 may slow down the build due to model memory pressure.")

    log(
        f"Build start: version={args.version}, jobs={jobs}, languages={', '.join(langs)}"
    )

    log("Checking build-time language models")
    ensure_language_models(langs, log=log)
    log("Build-time language models ready")

    failures = run_parallel(
        langs,
        args.version,
        jobs,
        args.continue_on_error,
    )

    elapsed = time.perf_counter() - overall_started_at

    if failures:
        log(f"Build finished with failures in {elapsed:.1f}s")
        for failure in failures:
            log(f"FAIL {failure}")
        raise SystemExit(1)

    log(f"Build finished successfully in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
