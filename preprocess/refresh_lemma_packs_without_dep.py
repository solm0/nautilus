import argparse
import json
import shutil
import sqlite3
import zipfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_STATIC_DIR = ROOT_DIR / "backend" / "data" / "static"
RELEASES_DIR = ROOT_DIR / "releases"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Remove dep keys from lemma pack payloads and rebuild lemma release zips.",
    )
    parser.add_argument(
        "--version",
        required=True,
        help="Language pack version, for example 1.1.0",
    )
    parser.add_argument(
        "--lang",
        action="append",
        dest="langs",
        help="Language code to process. Repeat to limit languages. Defaults to every static language dir.",
    )
    return parser.parse_args()


def iter_languages(selected_langs: list[str] | None, version: str):
    langs = selected_langs or sorted(
        child.name
        for child in BACKEND_STATIC_DIR.iterdir()
        if child.is_dir()
    )
    for lang in langs:
        static_dir = BACKEND_STATIC_DIR / lang / version
        if not static_dir.exists():
            raise FileNotFoundError(f"Missing static dir: {static_dir}")
        yield lang, static_dir


def strip_dep(value):
    if isinstance(value, dict):
        return {
            key: strip_dep(child)
            for key, child in value.items()
            if key != "dep"
        }
    if isinstance(value, list):
        return [strip_dep(item) for item in value]
    return value


def rewrite_db(db_path: Path):
    changed_rows = 0
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.cursor()
        rows = cursor.execute(
            "SELECT line_id, payload FROM lines WHERE instr(payload, '\"dep\"') > 0"
        ).fetchall()
        for line_id, payload in rows:
            cleaned = strip_dep(json.loads(payload))
            new_payload = json.dumps(cleaned, ensure_ascii=False)
            if new_payload == payload:
                continue
            cursor.execute(
                "UPDATE lines SET payload = ? WHERE line_id = ?",
                (new_payload, line_id),
            )
            changed_rows += 1
        connection.commit()
    finally:
        connection.close()
    return changed_rows


def vacuum_db(db_path: Path):
    connection = sqlite3.connect(db_path)
    try:
        connection.execute("VACUUM")
    finally:
        connection.close()


def build_release(lang: str, version: str, static_dir: Path):
    release_dir = RELEASES_DIR / lang / f"{lang}-v{version}"
    release_dir.mkdir(parents=True, exist_ok=True)

    source_db = static_dir / "lemma_pack.db"
    source_manifest = static_dir / "lemma_manifest.json"
    target_db = release_dir / "lemma_pack.db"
    target_manifest = release_dir / "lemma_manifest.json"
    target_zip = release_dir / f"{lang}-v{version}-lemma.zip"

    shutil.copy2(source_db, target_db)
    shutil.copy2(source_manifest, target_manifest)

    with zipfile.ZipFile(target_zip, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(target_db, arcname="lemma_pack.db")
        archive.write(target_manifest, arcname="lemma_manifest.json")

    return target_zip


def main():
    args = parse_args()
    for lang, static_dir in iter_languages(args.langs, args.version):
        db_path = static_dir / "lemma_pack.db"
        changed_rows = rewrite_db(db_path)
        vacuum_db(db_path)
        target_zip = build_release(lang, args.version, static_dir)
        print(
            f"{lang}: removed dep from {changed_rows} rows, vacuumed db, rebuilt {target_zip}"
        )


if __name__ == "__main__":
    main()
