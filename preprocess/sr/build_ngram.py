import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

from tqdm import tqdm

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from sqlite_pack_writer import (
    DB_FILENAME,
    connect_db,
    replace_ngram_tables,
    write_manifest,
)

# =====================
# CONFIG
# =====================

LANG = "sr"
VERSION = "1.0.0"

BASE_DIR = Path(__file__).resolve().parent

RELEASE_DIR = BASE_DIR / "../../releases/sr/sr-v1.0.0"

INPUT_FILE = BASE_DIR / "srp-rs_web_2016_1M-sentences.txt"

OUTPUT_DB = RELEASE_DIR / DB_FILENAME

NGRAM_K = 50
UNIGRAM_K = 20

MIN_COUNT = 2
UNI_MIN_COUNT = 2

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

# =====================
# TOKENIZER
# =====================

WORD_RE = re.compile(
    r"[a-zčćžšđ-]+",
    re.IGNORECASE,
)

def normalize(text):

    text = unicodedata.normalize("NFC", text)

    text = text.lower()

    text = cyr_to_lat(text)

    return text

def tokenize(text):

    text = normalize(text)

    tokens = WORD_RE.findall(text)

    return ["<s>"] + tokens + ["</s>"]

# =====================
# STORAGE
# =====================

trigram = defaultdict(Counter)

bigram = defaultdict(Counter)

unigram = Counter()

# =====================
# BUILD
# =====================

with open(INPUT_FILE, encoding="utf-8") as f:

    for line in tqdm(f):

        parts = line.strip().split("\t")

        if len(parts) < 2:
            continue

        tokens = tokenize(parts[1])

        for i, token in enumerate(tokens):

            unigram[token] += 1

            if i >= 1:
                bigram[(tokens[i - 1],)][token] += 1

            if i >= 2:
                trigram[
                    (tokens[i - 2], tokens[i - 1])
                ][token] += 1

# =====================
# TOP-K
# =====================

def build_topk_rows(counter_dict, trigram_mode):

    rows = []

    for ctx, cnt in counter_dict.items():

        items = [
            (w, c)
            for w, c in cnt.items()
            if c >= MIN_COUNT
        ]

        if not items:
            continue

        total = sum(c for _, c in items)

        items.sort(key=lambda x: -x[1])

        items = items[:NGRAM_K]

        for word, count in items:

            score = count / total

            if trigram_mode:

                rows.append(
                    (ctx[0], ctx[1], word, score)
                )

            else:

                rows.append(
                    (ctx[0], word, score)
                )

    return rows

tri_rows = build_topk_rows(
    trigram,
    trigram_mode=True,
)

bi_rows = build_topk_rows(
    bigram,
    trigram_mode=False,
)

uni_total = sum(unigram.values()) or 1

uni_rows = [
    (
        token,
        count / uni_total,
    )
    for token, count in unigram.items()
    if (
        token not in {"<s>", "</s>"}
        and count >= UNI_MIN_COUNT
    )
]

# =====================
# SQLITE
# =====================

conn = connect_db(OUTPUT_DB)

try:

    replace_ngram_tables(
        conn,
        tri_rows,
        bi_rows,
        uni_rows,
    )

finally:
    conn.close()

write_manifest(
    RELEASE_DIR,
    LANG,
    VERSION,
)

print(f"Saved {OUTPUT_DB.name}")
