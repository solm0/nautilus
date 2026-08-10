import json
import sqlite3
import threading
from pathlib import Path
from typing import Iterable


LEMMA_TABLES = {
    "lines",
    "lemma_graph",
    "lemma_stats",
}

NGRAM_TABLES = {
    "ngram_bi",
    "ngram_tri",
    "ngram_uni",
    "prefix_index",
}

PACK_TABLES = LEMMA_TABLES | NGRAM_TABLES

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

NGRAM_DB_NAMES = (
    "ngram_pack.sqlite3",
    "ngram_pack.sqlite",
    "ngram_pack.db",
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


def find_ngram_db(version_path: Path) -> Path | None:
    db_path = _find_named_db(version_path, NGRAM_DB_NAMES)

    if db_path is not None:
        return db_path

    legacy_path = _find_named_db(version_path, LEGACY_DB_NAMES)

    if legacy_path is not None and has_required_tables(legacy_path, NGRAM_TABLES):
        return legacy_path

    return None


def find_pack_db(version_path: Path) -> Path | None:
    return find_lemma_db(version_path)


def has_required_tables(
    db_path: Path,
    required_tables: Iterable[str] = PACK_TABLES,
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
        self.lemma_db_path, self.ngram_db_path = self._resolve_db_paths(self.db_path)
        self._local = threading.local()

    def _resolve_db_paths(self, path: Path) -> tuple[Path, Path]:
        if path.is_dir():
            lemma_db_path = find_lemma_db(path)
            ngram_db_path = find_ngram_db(path)
        else:
            lemma_db_path = path
            ngram_db_path = None

            if path.name in LEGACY_DB_NAMES:
                ngram_db_path = path
            else:
                for candidate_name in NGRAM_DB_NAMES:
                    candidate = path.with_name(candidate_name)
                    if candidate.exists():
                        ngram_db_path = candidate
                        break

        if lemma_db_path is None:
            raise ValueError(f"No lemma db found for {path}")

        if ngram_db_path is None:
            ngram_db_path = lemma_db_path

        return Path(lemma_db_path), Path(ngram_db_path)

    def _get_conn(self, kind: str = "lemma") -> sqlite3.Connection:
        attr = f"{kind}_conn"
        conn = getattr(self._local, attr, None)

        if conn is None:
            db_path = self.ngram_db_path if kind == "ngram" else self.lemma_db_path
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            setattr(self._local, attr, conn)

        return conn

    def _close_conn(self, kind: str):
        attr = f"{kind}_conn"
        conn = getattr(self._local, attr, None)

        if conn is None:
            return

        try:
            conn.close()
        finally:
            setattr(self._local, attr, None)

    def close(self):
        self._close_conn("lemma")
        self._close_conn("ngram")

    def _fetch_pairs(self, query: str, params=(), kind: str = "lemma"):
        try:
            rows = self._get_conn(kind).execute(query, params).fetchall()
        except sqlite3.Error:
            return []

        return [(row[0], row[1]) for row in rows]

    def _fetch_pairs_with_fallback(
        self,
        query: str,
        params=(),
        fallback_query: str | None = None,
        kind: str = "lemma",
    ):
        try:
            rows = self._get_conn(kind).execute(query, params).fetchall()
        except sqlite3.Error:
            if fallback_query is None:
                return []

            return self._fetch_pairs(fallback_query, params, kind=kind)

        return [(row[0], row[1]) for row in rows]

    def _fetch_json_payload(self, table: str, key_column: str, key: str):
        try:
            row = self._get_conn("lemma").execute(
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
                rows = self._get_conn("lemma").execute(
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

    def get_unigrams(self, limit: int | None = None):
        query = "SELECT token, score FROM ngram_uni ORDER BY score DESC"
        fallback_query = "SELECT token, freq FROM ngram_uni ORDER BY freq DESC"

        if limit is not None:
            query += " LIMIT ?"
            fallback_query += " LIMIT ?"
            return self._fetch_pairs_with_fallback(
                query,
                (limit,),
                fallback_query=fallback_query,
                kind="ngram",
            )

        return self._fetch_pairs_with_fallback(
            query,
            fallback_query=fallback_query,
            kind="ngram",
        )

    def get_bigram(self, context: tuple[str], limit: int | None = None):
        if not context:
            return []

        query = (
            "SELECT next_token, score "
            "FROM ngram_bi "
            "WHERE w1 = ? "
            "ORDER BY score DESC"
        )
        fallback_query = (
            "SELECT next_token, freq "
            "FROM ngram_bi "
            "WHERE w1 = ? "
            "ORDER BY freq DESC"
        )

        params = context

        if limit is not None:
            query += " LIMIT ?"
            fallback_query += " LIMIT ?"
            params = (*context, limit)

        return self._fetch_pairs_with_fallback(
            query,
            params,
            fallback_query=fallback_query,
            kind="ngram",
        )

    def get_trigram(self, context: tuple[str, str], limit: int | None = None):
        if len(context) != 2:
            return []

        query = (
            "SELECT next_token, score "
            "FROM ngram_tri "
            "WHERE w1 = ? AND w2 = ? "
            "ORDER BY score DESC"
        )
        fallback_query = (
            "SELECT next_token, freq "
            "FROM ngram_tri "
            "WHERE w1 = ? AND w2 = ? "
            "ORDER BY freq DESC"
        )

        params = context

        if limit is not None:
            query += " LIMIT ?"
            fallback_query += " LIMIT ?"
            params = (*context, limit)

        return self._fetch_pairs_with_fallback(
            query,
            params,
            fallback_query=fallback_query,
            kind="ngram",
        )

    def get_prefix_matches(self, prefix: str, limit: int | None = None):
        if not prefix:
            return []

        query = (
            "SELECT token, freq "
            "FROM prefix_index "
            "WHERE prefix = ? "
            "ORDER BY freq DESC"
        )
        params = (prefix,)

        if limit is not None:
            query += " LIMIT ?"
            params = (prefix, limit)

        return self._fetch_pairs(query, params, kind="ngram")

    def has_lemma_key(self, key: str) -> bool:
        try:
            row = self._get_conn("lemma").execute(
                "SELECT 1 FROM lemma_stats WHERE lemma_key = ? LIMIT 1",
                (key,),
            ).fetchone()
        except sqlite3.Error:
            return False

        return row is not None

    def get_related(self, key: str, limit: int = 5):
        related = self._fetch_json_payload("lemma_graph", "lemma_key", key)

        if not isinstance(related, list):
            return []

        return related[:limit]

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
