import json
import sqlite3
import threading
from pathlib import Path
from typing import Iterable


LEMMA_TABLES = {
    "lines",
    "lemma_stats",
}

PACK_DB_SUFFIXES = (".sqlite3", ".sqlite", ".db")

LEGACY_DB_NAMES = (
    "language_pack.sqlite3",
    "language_pack.sqlite",
    "language_pack.db",
    "pack.sqlite3",
    "pack.sqlite",
    "pack.db",
)

LEMMA_DB_NAMES = (
    "lemma_pack.sqlite3",
    "lemma_pack.sqlite",
    "lemma_pack.db",
    *LEGACY_DB_NAMES,
)

def _find_named_db(version_path: Path, preferred_names: tuple[str, ...]) -> Path | None:
    if not version_path.exists() or not version_path.is_dir():
        return None

    candidates = [
        path
        for path in sorted(version_path.iterdir())
        if path.is_file() and path.suffix.lower() in PACK_DB_SUFFIXES
    ]

    if not candidates:
        return None

    preferred_order = {name: index for index, name in enumerate(preferred_names)}
    matching = [path for path in candidates if path.name in preferred_order]

    if not matching:
        return None

    matching.sort(
        key=lambda path: (
            preferred_order[path.name],
            len(path.name),
            path.name,
        )
    )
    return matching[0]


def find_lemma_db(version_path: Path) -> Path | None:
    return _find_named_db(version_path, LEMMA_DB_NAMES)


def find_pack_db(version_path: Path) -> Path | None:
    return find_lemma_db(version_path)


def has_required_tables(
    db_path: Path,
    required_tables: Iterable[str] = LEMMA_TABLES,
) -> bool:
    try:
        conn = sqlite3.connect(db_path)
        try:
            rows = conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        finally:
            conn.close()
    except sqlite3.Error:
        return False

    existing = {name for (name,) in rows}
    return set(required_tables).issubset(existing)


class LanguagePackDB:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.lemma_db_path = self._resolve_db_path(self.db_path)
        self._local = threading.local()

    def _resolve_db_path(self, path: Path) -> Path:
        if path.is_dir():
            lemma_db_path = find_lemma_db(path)
        else:
            lemma_db_path = path

        if lemma_db_path is None:
            raise ValueError(f"No lemma db found for {path}")

        return Path(lemma_db_path)

    def _get_conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)

        if conn is None:
            conn = sqlite3.connect(self.lemma_db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            self._local.conn = conn

        return conn

    def close(self):
        conn = getattr(self._local, "conn", None)

        if conn is None:
            return

        try:
            conn.close()
        finally:
            self._local.conn = None

    def _fetch_json_payload(self, table: str, key_column: str, key: str):
        try:
            row = self._get_conn().execute(
                f"SELECT payload FROM {table} WHERE {key_column} = ?",
                (key,),
            ).fetchone()
        except sqlite3.Error:
            return None

        if row is None:
            return None

        try:
            return json.loads(row["payload"])
        except (TypeError, json.JSONDecodeError):
            return None

    def _fetch_json_payloads(self, table: str, key_column: str, keys: list[str]):
        if not keys:
            return {}

        result = {}
        chunk_size = 900

        for start in range(0, len(keys), chunk_size):
            chunk = keys[start:start + chunk_size]
            placeholders = ",".join("?" for _ in chunk)

            try:
                rows = self._get_conn().execute(
                    (
                        f"SELECT {key_column} AS key, payload "
                        f"FROM {table} "
                        f"WHERE {key_column} IN ({placeholders})"
                    ),
                    chunk,
                ).fetchall()
            except sqlite3.Error:
                continue

            for row in rows:
                try:
                    result[row["key"]] = json.loads(row["payload"])
                except (TypeError, json.JSONDecodeError):
                    continue

        return result

    def has_lemma_key(self, key: str) -> bool:
        try:
            row = self._get_conn().execute(
                "SELECT 1 FROM lemma_stats WHERE lemma_key = ? LIMIT 1",
                (key,),
            ).fetchone()
        except sqlite3.Error:
            return False

        return row is not None

    def get_line_ids(self, key: str):
        stats = self._fetch_json_payload("lemma_stats", "lemma_key", key)

        if not isinstance(stats, dict):
            return []

        line_ids = stats.get("lines", [])
        return line_ids if isinstance(line_ids, list) else []

    def get_furigana(self, key: str) -> str | None:
        stats = self._fetch_json_payload("lemma_stats", "lemma_key", key)

        if not isinstance(stats, dict):
            return None

        furigana = stats.get("furigana")
        if not isinstance(furigana, str):
            return None

        furigana = furigana.strip()
        return furigana or None

    def get_lines(self, line_ids: list[str]):
        rows = self._fetch_json_payloads("lines", "line_id", line_ids)
        return [rows[line_id] for line_id in line_ids if line_id in rows]

    def find_line_ids_by_token_forms(self, forms: list[str], limit: int = 1200):
        normalized_forms = [form.strip() for form in forms if isinstance(form, str) and form.strip()]

        if not normalized_forms:
            return []

        conditions = []
        params: list[str | int] = []

        for form in normalized_forms:
            lower_form = form.lower()
            capitalized_form = lower_form[:1].upper() + lower_form[1:]

            for variant in {lower_form, capitalized_form}:
                conditions.append("payload LIKE ?")
                params.append(f'%\"surface\": \"{variant}\"%')
                conditions.append("payload LIKE ?")
                params.append(f'%\"lemma\": \"{variant}\"%')

        params.append(limit)

        try:
            rows = self._get_conn("lemma").execute(
                (
                    "SELECT line_id "
                    "FROM lines "
                    f"WHERE {' OR '.join(conditions)} "
                    "LIMIT ?"
                ),
                params,
            ).fetchall()
        except sqlite3.Error:
            return []

        return [row["line_id"] for row in rows]
