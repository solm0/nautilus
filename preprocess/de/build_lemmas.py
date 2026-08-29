import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import spacy

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

LANG = "de"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)
INPUT_FILE = BASE_DIR / "deu_wikipedia_2021_300K-sentences.txt"
OUTPUT_DB = RELEASE_DIR / LEMMA_DB_FILENAME

MAX_LINES = None

GENERAL_MIN_FREQ = 3
PROPN_MIN_FREQ = 20

MAX_LINE_IDS = 200

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
    "sein",
    "haben",
    "werden",
    "können",
    "müssen",
    "sollen",
    "wollen",
    "dürfen",
    "mögen",
    "mehr",
    "bereits",
    "zunächst",
    "schließlich",
    "jedoch",
    "dann",
    "dort",
    "hier",
    "auch",
    "noch",
    "nur",
    "etwa",
    "wohl",
}

VALID_RE = re.compile(r"^[a-zäöüß]+$")


def normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower()


def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))


nlp = spacy.load("de_core_news_md", disable=["ner"])

lines_raw = []

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if i < 67:
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
line_id = 0

doc_progress = ProgressLogger("lemma parse", every=1500, total=len(lines_raw), unit="docs")
for doc_id, doc in enumerate(nlp.pipe(lines_raw, batch_size=64)):
    for sent in doc.sents:
        tokens = []

        for token in sent:
            lemma = normalize(token.lemma_)
            pos = token.pos_

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

            tokens.append({
                "surface": token.text,
                "lemma": lemma if valid else None,
                "pos": pos,
            })

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

conn = connect_db(OUTPUT_DB)
try:
    replace_lemma_tables(conn, lines_rows, stats_rows)
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
