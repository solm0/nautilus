import json
import sqlite3
import zipfile
from pathlib import Path


DB_FILENAME = "language_pack.db"
LEMMA_DB_FILENAME = "lemma_pack.db"


def connect_db(db_path: Path) -> sqlite3.Connection:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA synchronous=NORMAL")

    return conn


def build_archive_name(lang: str, version: str, pack_kind: str) -> str:
    return f"{lang}-v{version}-{pack_kind}.zip"


def write_manifest(
    release_dir: Path,
    lang: str,
    version: str,
    db_name: str = DB_FILENAME,
    manifest_name: str = "manifest.json",
    pack_kind: str | None = None,
    archive_name: str | None = None,
):
    manifest_path = Path(release_dir) / manifest_name
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    manifest = {
        "language": lang,
        "version": version,
        "files": {
            "pack_db": db_name,
        },
    }

    if pack_kind:
        manifest["kind"] = pack_kind

    if archive_name:
        manifest["files"]["archive"] = archive_name

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def package_release_artifact(
    release_dir: Path,
    lang: str,
    version: str,
    pack_kind: str,
    db_name: str,
    manifest_name: str,
):
    release_dir = Path(release_dir)
    archive_name = build_archive_name(lang, version, pack_kind)
    archive_path = release_dir / archive_name

    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as zip_ref:
        zip_ref.write(release_dir / db_name, arcname=db_name)

        manifest_path = release_dir / manifest_name
        if manifest_path.exists():
            zip_ref.write(manifest_path, arcname=manifest_name)

    return archive_path


def replace_lemma_tables(
    conn: sqlite3.Connection,
    lines_rows: list[tuple[int, str]],
    stats_rows: list[tuple[str, str]],
):
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS lines (
                line_id INTEGER PRIMARY KEY,
                payload TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lemma_stats (
                lemma_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );

            DELETE FROM lines;
            DELETE FROM lemma_stats;
            """
        )

        conn.executemany(
            "INSERT INTO lines(line_id, payload) VALUES (?, ?)",
            lines_rows,
        )
        conn.executemany(
            "INSERT INTO lemma_stats(lemma_key, payload) VALUES (?, ?)",
            stats_rows,
        )
