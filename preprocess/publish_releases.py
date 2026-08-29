import argparse
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import HfApi, hf_hub_url
from huggingface_hub.errors import HfHubHTTPError
import httpx


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from shared.manifests import PACKS


BACKEND_ENV_PATH = ROOT_DIR / "backend" / ".env"
RELEASES_DIR = ROOT_DIR / "releases"
DEFAULT_HF_REPO_ID = "solm0/nautilus-releases"
DEFAULT_HF_REPO_TYPE = "dataset"
MAX_RETRIES = 4
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def load_env():
    load_dotenv(BACKEND_ENV_PATH)

    token = os.getenv("HF_TOKEN")
    repo_id = os.getenv("HF_REPO_ID") or DEFAULT_HF_REPO_ID
    repo_type = os.getenv("HF_REPO_TYPE") or DEFAULT_HF_REPO_TYPE

    if not token:
        raise RuntimeError(f"HF_TOKEN is missing in {BACKEND_ENV_PATH}")

    return token, repo_id, repo_type


def is_retryable_error(exc: Exception) -> bool:
    if isinstance(exc, HfHubHTTPError):
        status_code = exc.response.status_code if exc.response is not None else None
        return status_code in RETRYABLE_STATUS_CODES

    return isinstance(exc, (httpx.HTTPError, TimeoutError))


def call_with_retry(label: str, fn, *args, **kwargs):
    delay = 2.0

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            if attempt >= MAX_RETRIES or not is_retryable_error(exc):
                raise

            print(
                f"{label} failed on attempt {attempt}/{MAX_RETRIES} with "
                f"{exc.__class__.__name__}: {exc}. Retrying in {delay:.0f}s...",
                file=sys.stderr,
            )
            time.sleep(delay)
            delay *= 2


def ensure_repo_exists(api: HfApi, repo_id: str, repo_type: str) -> None:
    try:
        call_with_retry(
            "create_repo",
            api.create_repo,
            repo_id=repo_id,
            repo_type=repo_type,
            private=False,
            exist_ok=True,
        )
        return
    except Exception as exc:
        if not is_retryable_error(exc):
            raise

        print(
            "create_repo still failed after retries. Checking whether the repo "
            "was created despite the timeout...",
            file=sys.stderr,
        )
        call_with_retry(
            "repo_info",
            api.repo_info,
            repo_id=repo_id,
            repo_type=repo_type,
        )


def get_pack_map():
    return {pack["lang"]: pack for pack in PACKS}


def resolve_release_artifact(lang: str, version: str):
    release_dir = RELEASES_DIR / lang / f"{lang}-v{version}"
    lemma_zip = release_dir / f"{lang}-v{version}-lemma.zip"
    if not lemma_zip.exists():
        raise FileNotFoundError(
            f"Missing release artifact for {lang} v{version}: {lemma_zip.name}"
        )

    return lemma_zip


def upload_asset(api: HfApi, repo_id: str, repo_type: str, lang: str, version: str, asset_path: Path):
    path_in_repo = f"language-packs/{lang}/{version}/{asset_path.name}"
    call_with_retry(
        f"upload_file:{asset_path.name}",
        api.upload_file,
        path_or_fileobj=str(asset_path),
        path_in_repo=path_in_repo,
        repo_id=repo_id,
        repo_type=repo_type,
        commit_message=f"Upload {lang} {version} {asset_path.name}",
    )
    return hf_hub_url(
        repo_id=repo_id,
        repo_type=repo_type,
        revision="main",
        filename=path_in_repo,
    )


def publish_language(api: HfApi, repo_id: str, repo_type: str, lang: str, version: str):
    asset_path = resolve_release_artifact(lang, version)
    print(f"Uploading {asset_path.name} -> language-packs/{lang}/{version}/")
    url = upload_asset(api, repo_id, repo_type, lang, version, asset_path)

    print(f"Published {lang} v{version}")
    print(f"  lemma: {url}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload lemma zip assets to Hugging Face.",
    )
    parser.add_argument(
        "--lang",
        action="append",
        dest="langs",
        help="Language code to publish. Repeat for multiple languages. Defaults to all PACKS languages.",
    )
    parser.add_argument(
        "--version",
        help="Override version for all selected languages. Defaults to central/packs.py version per language.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    token, repo_id, repo_type = load_env()
    pack_map = get_pack_map()
    api = HfApi(token=token)
    ensure_repo_exists(api, repo_id=repo_id, repo_type=repo_type)

    langs = args.langs or list(pack_map.keys())

    for lang in langs:
        pack = pack_map.get(lang)

        if pack is None:
            raise KeyError(f"Unknown language: {lang}")

        version = args.version or pack["version"]
        publish_language(api, repo_id, repo_type, lang, version)


if __name__ == "__main__":
    main()
