import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import spacy
from pymorphy3 import MorphAnalyzer

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from sqlite_pack_writer import (
    LEMMA_DB_FILENAME,
    connect_db,
    package_release_artifact,
    replace_lemma_tables,
    write_manifest,
)
from build_config import get_release_dir, get_version
from progress import ProgressLogger, log

LANG = "ru"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)
INPUT_FILE = BASE_DIR / "rus_wikipedia_2021_300K-sentences.txt"
OUTPUT_DB = RELEASE_DIR / LEMMA_DB_FILENAME

MAX_LINES = None

GENERAL_MIN_FREQ = 3
PROPN_MIN_FREQ = 20

TOP_K = 5
MAX_LINE_IDS = 200
BATCH_SIZE = 128

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
}

STOP_LEMMAS = {
    "быть",
    "мочь",
    "сказать",
    "становиться",
    "более",
    "уже",
    "затем",
    "однако",
    "тогда",
    "там",
    "здесь",
    "также",
    "ещё",
    "только",
    "примерно",
}

VALID_RE = re.compile(r"^[а-яё-]+$")


def normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower().strip()


def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))


nlp = spacy.load("ru_core_news_md", disable=["ner"])
nlp.max_length = 10_000_000
morph = MorphAnalyzer()

lines_raw = []

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if i < 470:
            continue

        line = line.strip()

        if not line:
            continue

        if "\t" in line:
            line = line.split("\t", 1)[1]

        lines_raw.append(line)

        if MAX_LINES and len(lines_raw) >= MAX_LINES:
            break

log(f"loaded: {len(lines_raw):,} raw lines")

lines_out = []
lemma_freq = Counter()
lemma_lines = defaultdict(set)
contexts = defaultdict(Counter)
line_id = 0
lemma_cache = {}


def get_lemma(token):
    text = normalize(token.text)

    if text in lemma_cache:
        return lemma_cache[text]

    if token.pos_ == "PROPN":
        lemma = text
    else:
        try:
            lemma = morph.parse(text)[0].normal_form
        except Exception:
            lemma = token.lemma_

    lemma = normalize(lemma)
    lemma_cache[text] = lemma
    return lemma


doc_progress = ProgressLogger("lemma parse", every=1500, total=len(lines_raw), unit="docs")
for doc_id, doc in enumerate(nlp.pipe(lines_raw, batch_size=BATCH_SIZE)):
    for sent in doc.sents:
        tokens = []
        token_keys = {}

        for token in sent:
            pos = token.pos_
            lemma = get_lemma(token)

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
                token_keys[token.i] = key

            tokens.append({
                "surface": token.text,
                "lemma": lemma if valid else None,
                "pos": pos,
            })

        for token in sent:
            if token.i not in token_keys:
                continue

            head = token.head

            if head.i == token.i:
                continue

            if head.i not in token_keys:
                continue

            a = token_keys[token.i]
            b = token_keys[head.i]

            if a == b:
                continue

            contexts[a][b] += 1
            contexts[b][a] += 1

        lines_out.append({
            "line_id": line_id,
            "tokens": tokens,
        })
        line_id += 1

    doc_progress.update(doc_id + 1, extra=f"sentences={line_id:,}")

log(f"lines: {len(lines_out):,}")

valid_lemmas = set()

for lemma, freq in lemma_freq.items():
    pos = lemma.rsplit("_", 1)[1]

    if pos == "PROPN":
        if freq >= PROPN_MIN_FREQ:
            valid_lemmas.add(lemma)
    elif freq >= GENERAL_MIN_FREQ:
        valid_lemmas.add(lemma)

log(f"valid lemmas: {len(valid_lemmas):,}")

graph = {}

for lemma in valid_lemmas:
    candidates = []
    freq_a = lemma_freq[lemma]

    for other, cofreq in contexts[lemma].items():
        if other not in valid_lemmas:
            continue

        freq_b = lemma_freq[other]
        score = cofreq / math.sqrt(freq_a * freq_b)
        score *= 1 / math.log1p(freq_b)
        candidates.append((other, score))

    candidates.sort(key=lambda x: x[1], reverse=True)
    graph[lemma] = [word for word, _ in candidates[:TOP_K]]

stats = {}

for lemma in valid_lemmas:
    stats[lemma] = {
        "freq": lemma_freq[lemma],
        "lines": list(lemma_lines[lemma])[:MAX_LINE_IDS],
    }

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
    replace_lemma_tables(conn, lines_rows, stats_rows, graph_rows)
finally:
    conn.close()

write_manifest(
    RELEASE_DIR,
    LANG,
    VERSION,
    db_name=LEMMA_DB_FILENAME,
    manifest_name="lemma_manifest.json",
    pack_kind="lemma",
)
package_release_artifact(
    RELEASE_DIR,
    LANG,
    VERSION,
    "lemma",
    LEMMA_DB_FILENAME,
    "lemma_manifest.json",
)

print("DONE")
print(f"Saved {OUTPUT_DB.name}")
