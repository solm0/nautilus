import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from sqlite_pack_writer import (
    NGRAM_DB_FILENAME,
    connect_db,
    package_release_artifact,
    replace_prefix_index,
    write_manifest,
)
from build_config import get_release_dir, get_version
from progress import ProgressLogger

# =====================
# CONFIG
# =====================

LANG = "sq"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent

RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)

INPUT_FILE = BASE_DIR / "sqi_news_2020_1M-words.txt"

OUTPUT_DB = RELEASE_DIR / NGRAM_DB_FILENAME

MAX_PREFIX_LEN = 5
MIN_FREQ = 5
TOP_K = 50

WORD_RE = re.compile(
    r"^[a-zçë-]+$",
    re.IGNORECASE,
)


def normalize(word):
    word = unicodedata.normalize("NFC", word)
    return word.lower().strip()


prefix_index = defaultdict(dict)
line_progress = ProgressLogger("prefix input", every=50000, unit="lines")

with open(INPUT_FILE, encoding="utf-8") as f:
    for line_count, line in enumerate(f, start=1):
        parts = line.strip().split("\t")

        if len(parts) < 3:
            continue

        _, word, freq = parts

        try:
            freq = int(freq)
        except ValueError:
            continue

        if freq < MIN_FREQ:
            continue

        word = normalize(word)

        if not WORD_RE.fullmatch(word):
            continue

        max_len = min(len(word), MAX_PREFIX_LEN)

        for i in range(1, max_len + 1):
            prefix = word[:i]
            prev = prefix_index[prefix].get(word)

            if prev is None or freq > prev:
                prefix_index[prefix][word] = freq

        line_progress.update(line_count, extra=f"prefixes={len(prefix_index):,}")


rows = []

for prefix, items in prefix_index.items():
    top_items = sorted(
        items.items(),
        key=lambda x: -x[1],
    )[:TOP_K]

    rows.extend(
        (prefix, word, freq)
        for word, freq in top_items
    )

line_progress.update(
    line_count if "line_count" in locals() else 0,
    extra=f"final_prefixes={len(prefix_index):,} final_rows={len(rows):,}",
    force=True,
)


conn = connect_db(OUTPUT_DB)

try:
    replace_prefix_index(
        conn,
        rows,
    )
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
