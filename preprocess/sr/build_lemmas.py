import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
import classla

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from sqlite_pack_writer import (
    DB_FILENAME,
    connect_db,
    replace_lemma_tables,
    write_manifest,
)

# =====================
# CONFIG
# =====================

LANG = "sr"
VERSION = "1.0.0"
classla.download("sr")

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = BASE_DIR / "../../releases/sr/sr-v1.0.0"

INPUT_FILE = BASE_DIR / "srp_wikipedia_2021_300K-sentences.txt"

OUTPUT_DB = RELEASE_DIR / DB_FILENAME

MAX_LINES = None

GENERAL_MIN_FREQ = 3
PROPN_MIN_FREQ = 20

TOP_K = 5
MAX_LINE_IDS = 200
BATCH_SIZE = 64

STOP_POS = {
    "PUNCT",
    "SYM",
    "SPACE",
    "DET",
    "CCONJ",
    "SCONJ",
    "PART",
    "PRON",
    "ADP",
    "AUX",
}

STOP_LEMMAS = {
    "biti",
    "hteti",
    "moći",
    "trebati",
}

VALID_RE = re.compile(r"^[a-zčćžšđ-]+$")

# =====================
# SERBIAN CYRILLIC → LATIN
# =====================

CYR_MAP = {
    "а":"a","б":"b","в":"v","г":"g","д":"d",
    "ђ":"đ","е":"e","ж":"ž","з":"z","и":"i",
    "ј":"j","к":"k","л":"l","љ":"lj","м":"m",
    "н":"n","њ":"nj","о":"o","п":"p","р":"r",
    "с":"s","т":"t","ћ":"ć","у":"u","ф":"f",
    "х":"h","ц":"c","ч":"č","џ":"dž","ш":"š",
}

def cyr_to_lat(text: str) -> str:
    out = []

    for ch in text:
        out.append(CYR_MAP.get(ch, ch))

    return "".join(out)

# =====================
# NORMALIZE
# =====================

def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()
    text = cyr_to_lat(text)
    return text

def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))

# =====================
# NLP
# =====================

nlp = classla.Pipeline(
    lang="sr",
    processors="tokenize,pos,lemma,depparse",
    use_gpu=False,
)

# =====================
# LOAD INPUT
# =====================

lines_raw = []

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()

        if not line:
            continue

        if "\t" in line:
            line = line.split("\t", 1)[1]

        lines_raw.append(line)

        if MAX_LINES and len(lines_raw) >= MAX_LINES:
            break

print("loaded:", len(lines_raw))

# =====================
# STORAGE
# =====================

lines_out = []

lemma_freq = Counter()
lemma_lines = defaultdict(set)
contexts = defaultdict(Counter)

lemma_cache = {}

line_id = 0

# =====================
# PARSE
# =====================

for batch_start in range(0, len(lines_raw), BATCH_SIZE):

    batch = lines_raw[
        batch_start : batch_start + BATCH_SIZE
    ]

    text = "\n\n".join(batch)

    doc = nlp(text)

    for sent in doc.sentences:

        tokens = []

        token_keys = {}

        for word in sent.words:

            idx = word.id

            surface = normalize(word.text)

            lemma = normalize(word.lemma or "")

            pos = word.upos or ""

            valid = True

            if (
                not lemma
                or pos in STOP_POS
                or lemma in STOP_LEMMAS
                or not valid_lemma(lemma)
            ):
                valid = False

            if valid:

                key = f"{lemma}_{pos}"

                lemma_freq[key] += 1

                lemma_lines[key].add(line_id)

                token_keys[idx] = key

            tokens.append({
                "surface": surface,
                "lemma": lemma if valid else None,
                "pos": pos,
                "dep": (word.deprel or "").lower() or None,
            })

        # dependency graph

        for word in sent.words:

            idx = word.id

            if idx not in token_keys:
                continue

            head_idx = word.head

            if head_idx == 0:
                continue

            if head_idx not in token_keys:
                continue

            a = token_keys[idx]
            b = token_keys[head_idx]

            if a == b:
                continue

            contexts[a][b] += 1
            contexts[b][a] += 1

        lines_out.append({
            "line_id": line_id,
            "tokens": tokens,
        })

        line_id += 1

    print(
        "processed:",
        min(batch_start + BATCH_SIZE, len(lines_raw))
    )

print("lines:", len(lines_out))

# =====================
# FILTER VALID LEMMAS
# =====================

valid_lemmas = set()

for lemma, freq in lemma_freq.items():

    pos = lemma.rsplit("_", 1)[1]

    if pos == "PROPN":
        if freq >= PROPN_MIN_FREQ:
            valid_lemmas.add(lemma)

    elif freq >= GENERAL_MIN_FREQ:
        valid_lemmas.add(lemma)

print("valid lemmas:", len(valid_lemmas))

# =====================
# BUILD GRAPH
# =====================

graph = {}

for lemma in valid_lemmas:

    freq_a = lemma_freq[lemma]

    candidates = []

    for other, cofreq in contexts[lemma].items():

        if other not in valid_lemmas:
            continue

        freq_b = lemma_freq[other]

        score = cofreq / math.sqrt(freq_a * freq_b)
        score *= 1 / math.log1p(freq_b)

        candidates.append((other, score))

    candidates.sort(key=lambda x: x[1], reverse=True)

    graph[lemma] = [
        word
        for word, _ in candidates[:TOP_K]
    ]

# =====================
# STATS
# =====================

stats = {}

for lemma in valid_lemmas:

    stats[lemma] = {
        "freq": lemma_freq[lemma],
        "lines": list(lemma_lines[lemma])[:MAX_LINE_IDS],
    }

# =====================
# SQLITE
# =====================

lines_rows = [
    (line["line_id"], json.dumps(line, ensure_ascii=False))
    for line in lines_out
]

stats_rows = [
    (lemma, json.dumps(payload, ensure_ascii=False))
    for lemma, payload in stats.items()
]

graph_rows = [
    (lemma, json.dumps(payload, ensure_ascii=False))
    for lemma, payload in graph.items()
]

conn = connect_db(OUTPUT_DB)

try:
    replace_lemma_tables(
        conn,
        lines_rows,
        stats_rows,
        graph_rows,
    )
finally:
    conn.close()

write_manifest(RELEASE_DIR, LANG, VERSION)

print("DONE")
print(f"Saved {OUTPUT_DB.name}")
