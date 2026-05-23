import sys
from collections import defaultdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from sqlite_pack_writer import DB_FILENAME, connect_db, replace_prefix_index, write_manifest

LANG = "ru"
VERSION = "1.0.0"

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = BASE_DIR / "../../releases/ru/ru-v1.0.0"
INPUT_FILE = BASE_DIR / "rus-ru_web-public_2019_1M-words.txt"
OUTPUT_DB = RELEASE_DIR / DB_FILENAME

MAX_PREFIX_LEN = 5
MIN_FREQ = 5
TOP_K = 50

prefix_index = defaultdict(list)

with open(INPUT_FILE, encoding="utf-8") as f:
    for line in f:
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

        word = word.lower().replace("ё", "е")
        max_len = min(len(word), MAX_PREFIX_LEN)

        for i in range(1, max_len + 1):
            prefix_index[word[:i]].append((word, freq))


rows = []

for prefix, items in prefix_index.items():
    deduped = {}

    for word, freq in items:
        if word not in deduped or deduped[word] < freq:
            deduped[word] = freq

    top_items = sorted(deduped.items(), key=lambda x: -x[1])[:TOP_K]
    rows.extend((prefix, word, freq) for word, freq in top_items)

conn = connect_db(OUTPUT_DB)
try:
    replace_prefix_index(conn, rows)
finally:
    conn.close()

write_manifest(RELEASE_DIR, LANG, VERSION)

print(f"Saved {OUTPUT_DB.name}")
