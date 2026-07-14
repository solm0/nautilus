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

LANG = "sr"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent

RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)

INPUT_FILE = BASE_DIR / "srp-rs_web_2016_1M-words.txt"

OUTPUT_DB = RELEASE_DIR / NGRAM_DB_FILENAME

MAX_PREFIX_LEN = 5

MIN_FREQ = 5

TOP_K = 50

# =====================
# CYR → LAT
# =====================

CYR_MAP = {
    "а":"a","б":"b","в":"v","г":"g","д":"d",
    "ђ":"đ","е":"e","ж":"ž","з":"z","и":"i",
    "ј":"j","к":"k","л":"l","љ":"lj","м":"m",
    "н":"n","њ":"nj","о":"o","п":"p","р":"r",
    "с":"s","т":"t","ћ":"ć","у":"u","ф":"f",
    "х":"h","ц":"c","ч":"č","џ":"dž","ш":"š",
}

def cyr_to_lat(text):
    return "".join(CYR_MAP.get(ch, ch) for ch in text)

WORD_RE = re.compile(
    r"^[a-zčćžšđ-]+$"
)

def normalize(word):

    word = unicodedata.normalize(
        "NFC",
        word,
    )

    word = word.lower()

    word = cyr_to_lat(word)

    return word

# =====================
# PREFIX INDEX
# =====================

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

        max_len = min(
            len(word),
            MAX_PREFIX_LEN,
        )

        for i in range(1, max_len + 1):

            prefix = word[:i]
            prev = prefix_index[prefix].get(word)

            if prev is None or freq > prev:
                prefix_index[prefix][word] = freq

        line_progress.update(line_count, extra=f"prefixes={len(prefix_index):,}")

# =====================
# BUILD ROWS
# =====================

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

# =====================
# SQLITE
# =====================

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
