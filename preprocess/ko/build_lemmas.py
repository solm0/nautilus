import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import stanza

PREPROCESS_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]

for path in (PREPROCESS_DIR, PROJECT_ROOT):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.append(path_str)

from shared.services.nlp_service import is_stop_pos, normalize_lemma
from sqlite_pack_writer import (
    DB_FILENAME,
    connect_db,
    replace_lemma_tables,
    write_manifest,
)


LANG = "ko"
VERSION = "1.0.0"

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = BASE_DIR / "../../releases/ko/ko-v1.0.0"
INPUT_FILE = BASE_DIR / "kor_wikipedia_2021_300K-sentences.txt"
OUTPUT_DB = RELEASE_DIR / DB_FILENAME

MAX_LINES = None

GENERAL_MIN_FREQ = 3
PROPN_MIN_FREQ = 20

TOP_K = 5
MAX_LINE_IDS = 200
BATCH_SIZE = 64

VALID_RE = re.compile(r"^[0-9a-z가-힣]+$", re.UNICODE)


def normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower().strip()


def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))


def representative_morph(morphs: list[dict]):
    for morph in morphs:
        lemma = morph.get("lemma")
        pos = morph.get("pos")

        if not lemma or not pos or is_stop_pos(pos, "ko"):
            continue

        return morph

    return None


nlp = stanza.Pipeline(
    lang="ko",
    processors="tokenize,pos,lemma,depparse",
    use_gpu=False,
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

print("loaded:", len(lines_raw))

lines_out = []
lemma_freq = Counter()
lemma_lines = defaultdict(set)
contexts = defaultdict(Counter)
line_id = 0

for batch_start in range(0, len(lines_raw), BATCH_SIZE):
    batch = lines_raw[batch_start: batch_start + BATCH_SIZE]
    text = "\n\n".join(batch)
    doc = nlp(text)

    for sent in doc.sentences:
        tokens = []
        token_keys = {}

        for token in sent.tokens:
            morphs = []

            for word in token.words:
                lemma = normalize_lemma(word.lemma)
                pos = word.upos or ""

                morphs.append({
                    "surface": word.text,
                    "lemma": lemma,
                    "pos": pos,
                    "dep": (word.deprel or "").lower() or None,
                })

                valid = True

                if (
                    not lemma
                    or not pos
                    or is_stop_pos(pos, "ko")
                    or not valid_lemma(lemma)
                ):
                    valid = False

                if valid:
                    key = f"{lemma}_{pos}"
                    lemma_freq[key] += 1
                    lemma_lines[key].add(line_id)
                    token_keys[word.id] = key

            representative = representative_morph(morphs)
            fallback = morphs[0] if morphs else None

            tokens.append({
                "surface": token.text,
                "lemma": representative["lemma"] if representative else None,
                "pos": representative["pos"] if representative else (fallback["pos"] if fallback else None),
                "dep": (
                    representative["dep"]
                    if representative and representative.get("dep")
                    else (fallback["dep"] if fallback else None)
                ),
                "morphs": morphs,
            })

        for word in sent.words:
            idx = word.id

            if idx not in token_keys:
                continue

            head_idx = word.head

            if head_idx == 0 or head_idx not in token_keys:
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

    print("processed:", min(batch_start + BATCH_SIZE, len(lines_raw)))

print("lines:", len(lines_out))

valid_lemmas = set()

for lemma, freq in lemma_freq.items():
    pos = lemma.rsplit("_", 1)[1]

    if pos == "PROPN":
        if freq >= PROPN_MIN_FREQ:
            valid_lemmas.add(lemma)
    elif freq >= GENERAL_MIN_FREQ:
        valid_lemmas.add(lemma)

print("valid lemmas:", len(valid_lemmas))

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

write_manifest(RELEASE_DIR, LANG, VERSION)

print("DONE")
print(f"Saved {OUTPUT_DB.name}")
