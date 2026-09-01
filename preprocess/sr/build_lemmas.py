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
    LEMMA_DB_FILENAME,
    connect_db,
    package_release_artifact,
    replace_lemma_tables,
    serialize_lemma_payload,
    write_manifest,
)
from build_config import get_release_dir, get_version
from model_setup import ensure_language_model
from progress import ProgressLogger, log

# =====================
# CONFIG
# =====================

LANG = "sr"
VERSION = get_version("1.1.0")

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = (BASE_DIR / "../../backend/classla_models").resolve()
RELEASE_DIR = get_release_dir(BASE_DIR, LANG, VERSION)

INPUT_FILE = BASE_DIR / "srp_wikipedia_2021_300K-sentences.txt"

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
    "X",
}

STOP_LEMMAS = {
    "biti",
    "hteti",
    "moći",
    "trebati",
    "a",
    "ali",
    "bi",
    "bio",
    "bila",
    "bili",
    "bilo",
    "da",
    "do",
    "dok",
    "ga",
    "gde",
    "i",
    "ili",
    "ima",
    "iz",
    "je",
    "jer",
    "još",
    "kada",
    "kao",
    "kako",
    "kod",
    "koji",
    "koja",
    "koje",
    "međutim",
    "mu",
    "na",
    "ne",
    "nekoliko",
    "nije",
    "o",
    "od",
    "oko",
    "on",
    "po",
    "sa",
    "samo",
    "se",
    "su",
    "sve",
    "tako",
    "takođe",
    "to",
    "toga",
    "u",
    "za",
    "će",
    "što",
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

# Keep preprocess using the repo-local model cache rather than home-dir resources.
ensure_language_model(LANG, log=log)

# =====================
# NLP
# =====================

nlp = classla.Pipeline(
    lang="sr",
    processors="tokenize,pos,lemma",
    dir=str(MODEL_DIR),
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

log(f"loaded: {len(lines_raw):,} raw lines")

# =====================
# STORAGE
# =====================

lines_out = []

lemma_freq = Counter()
lemma_lines = defaultdict(set)

lemma_cache = {}

line_id = 0

# =====================
# PARSE
# =====================

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

log(f"valid lemmas: {len(valid_lemmas):,}")

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
    (line["line_id"], serialize_lemma_payload({"tokens": line["tokens"]}))
    for line in lines_out
]

stats_rows = [
    (lemma, serialize_lemma_payload(payload))
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
