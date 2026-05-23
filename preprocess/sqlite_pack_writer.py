import json
import sqlite3
from pathlib import Path


DB_FILENAME = "language_pack.db"


def connect_db(db_path: Path) -> sqlite3.Connection:
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=DELETE")
    conn.execute("PRAGMA synchronous=NORMAL")

    return conn


def write_manifest(release_dir: Path, lang: str, version: str, db_name: str = DB_FILENAME):
    manifest_path = Path(release_dir) / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    manifest = {
        "language": lang,
        "version": version,
        "files": {
            "pack_db": db_name,
        },
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def replace_ngram_tables(
    conn: sqlite3.Connection,
    trigram_rows: list[tuple[str, str, str, float]],
    bigram_rows: list[tuple[str, str, float]],
    unigram_rows: list[tuple[str, float]],
):
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ngram_uni (
                token TEXT PRIMARY KEY,
                score REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS ngram_bi (
                w1 TEXT NOT NULL,
                next_token TEXT NOT NULL,
                score REAL NOT NULL,
                PRIMARY KEY (w1, next_token)
            );

            CREATE TABLE IF NOT EXISTS ngram_tri (
                w1 TEXT NOT NULL,
                w2 TEXT NOT NULL,
                next_token TEXT NOT NULL,
                score REAL NOT NULL,
                PRIMARY KEY (w1, w2, next_token)
            );

            DELETE FROM ngram_uni;
            DELETE FROM ngram_bi;
            DELETE FROM ngram_tri;
            """
        )

        conn.executemany(
            "INSERT INTO ngram_uni(token, score) VALUES (?, ?)",
            unigram_rows,
        )
        conn.executemany(
            "INSERT INTO ngram_bi(w1, next_token, score) VALUES (?, ?, ?)",
            bigram_rows,
        )
        conn.executemany(
            "INSERT INTO ngram_tri(w1, w2, next_token, score) VALUES (?, ?, ?, ?)",
            trigram_rows,
        )


def replace_prefix_index(
    conn: sqlite3.Connection,
    prefix_rows: list[tuple[str, str, int]],
):
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS prefix_index (
                prefix TEXT NOT NULL,
                token TEXT NOT NULL,
                freq INTEGER NOT NULL,
                PRIMARY KEY (prefix, token)
            );

            DELETE FROM prefix_index;
            """
        )

        conn.executemany(
            "INSERT INTO prefix_index(prefix, token, freq) VALUES (?, ?, ?)",
            prefix_rows,
        )


def replace_lemma_tables(
    conn: sqlite3.Connection,
    lines_rows: list[tuple[int, str]],
    stats_rows: list[tuple[str, str]],
    graph_rows: list[tuple[str, str]],
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

            CREATE TABLE IF NOT EXISTS lemma_graph (
                lemma_key TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );

            DELETE FROM lines;
            DELETE FROM lemma_stats;
            DELETE FROM lemma_graph;
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
        conn.executemany(
            "INSERT INTO lemma_graph(lemma_key, payload) VALUES (?, ?)",
            graph_rows,
        )
