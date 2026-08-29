import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import stanza

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

# =====================
# CONFIG
# =====================

LANG = "sq"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = (BASE_DIR / "../../backend/models").resolve()

RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)

INPUT_FILE = BASE_DIR / "sqi_wikipedia_2021_300K-sentences.txt"

OUTPUT_DB = RELEASE_DIR / LEMMA_DB_FILENAME

MAX_LINES = None

GENERAL_MIN_FREQ = 3
PROPN_MIN_FREQ = 20

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
    "jam",
    "kam",
    "mund",
    "duhet",
}

VALID_RE = re.compile(r"^[a-zçë-]+$")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    return text.lower().strip()


def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))


nlp = stanza.Pipeline(
    lang="sq",
    processors="tokenize,pos,lemma",
    use_gpu=False,
    dir=str(MODEL_DIR),
    download_method=None,
)


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

log(f"loaded: {len(lines_raw):,} raw lines")


lines_out = []
lemma_freq = Counter()
lemma_lines = defaultdict(set)

line_id = 0

batch_progress = ProgressLogger("lemma parse", every=1500, total=len(lines_raw), unit="lines")
for batch_start in range(0, len(lines_raw), BATCH_SIZE):
    batch = lines_raw[
        batch_start : batch_start + BATCH_SIZE
    ]

    text = "\n\n".join(batch)
    doc = nlp(text)

    for sent in doc.sentences:
        tokens = []

        for word in sent.words:
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

            tokens.append({
                "surface": surface,
                "lemma": lemma if valid else None,
                "pos": pos,
            })

        lines_out.append({
            "line_id": line_id,
            "tokens": tokens,
        })

        line_id += 1

    batch_progress.update(
        min(batch_start + BATCH_SIZE, len(lines_raw)),
        extra=f"sentences={line_id:,}",
    )

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
    replace_lemma_tables(
        conn,
        lines_rows,
        stats_rows,
    )
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
