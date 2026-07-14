import sys
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from sqlite_pack_writer import (
    NGRAM_DB_FILENAME,
    connect_db,
    package_release_artifact,
    replace_ngram_tables,
    write_manifest,
)
from build_config import get_release_dir, get_version
from progress import ProgressLogger

# ---------- CONFIG ----------
NGRAM_K = 50
UNIGRAM_K = 20
MIN_COUNT = 1
LANG = "en"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)
INPUT_FILE = BASE_DIR / "eng-uk_web-public_2018_1M-sentences.txt"
OUTPUT_DB = RELEASE_DIR / NGRAM_DB_FILENAME


# ---------- TOKENIZER ----------
def tokenize(text):
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"[^a-z\-\' ]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    tokens = text.split()
    tokens = [t for t in tokens if len(t) >= 2]
    return ["<s>"] + tokens + ["</s>"]


def build_topk_rows(counter_dict, trigram_mode: bool):
    rows = []

    for ctx, cnt in counter_dict.items():
        items = [(w, c) for w, c in cnt.items() if c >= MIN_COUNT]

        if not items:
            continue

        total = sum(c for _, c in items) or 1
        items = sorted(items, key=lambda x: -x[1])[:NGRAM_K]

        for word, count in items:
            score = count / total

            if trigram_mode:
                rows.append((ctx[0], ctx[1], word, score))
            else:
                rows.append((ctx[0], word, score))

    return rows


# ---------- NGRAM COUNT ----------
trigram = defaultdict(Counter)
bigram = defaultdict(Counter)
unigram = Counter()
line_progress = ProgressLogger("ngram input", every=50000, unit="lines")

with open(INPUT_FILE, encoding="utf-8") as f:
    for line_count, line in enumerate(f, start=1):
        parts = line.strip().split("\t")

        if len(parts) < 2:
            continue

        tokens = tokenize(parts[1])

        for i, token in enumerate(tokens):
            unigram[token] += 1

            if i >= 1:
                bigram[(tokens[i - 1],)][token] += 1

            if i >= 2:
                trigram[(tokens[i - 2], tokens[i - 1])][token] += 1

        line_progress.update(
            line_count,
            extra=f"uni={len(unigram):,} bi_ctx={len(bigram):,} tri_ctx={len(trigram):,}",
        )


tri_rows = build_topk_rows(trigram, trigram_mode=True)
bi_rows = build_topk_rows(bigram, trigram_mode=False)

uni_total = sum(unigram.values()) or 1
uni_rows = sorted(
    [
        (token, count)
        for token, count in unigram.items()
        if token not in {"<s>", "</s>"}
    ],
    key=lambda x: -x[1],
)[:UNIGRAM_K]
uni_rows = [(token, count / uni_total) for token, count in uni_rows]
line_progress.update(
    line_count if "line_count" in locals() else 0,
    extra=f"final_uni={len(uni_rows):,} final_bi={len(bi_rows):,} final_tri={len(tri_rows):,}",
    force=True,
)

conn = connect_db(OUTPUT_DB)
try:
    replace_ngram_tables(conn, tri_rows, bi_rows, uni_rows)
finally:
    conn.close()

write_manifest(
    RELEASE_DIR,
    LANG,
    VERSION,
    db_name=NGRAM_DB_FILENAME,
    manifest_name="ngram_manifest.json",
    pack_kind="ngram",
)
package_release_artifact(
    RELEASE_DIR,
    LANG,
    VERSION,
    "ngram",
    NGRAM_DB_FILENAME,
    "ngram_manifest.json",
)

print(f"Saved {OUTPUT_DB.name}")
