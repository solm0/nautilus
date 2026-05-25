import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import stanza

PREPROCESS_DIR = Path(__file__).resolve().parents[1]
if str(PREPROCESS_DIR) not in sys.path:
    sys.path.append(str(PREPROCESS_DIR))

from sqlite_pack_writer import (
    DB_FILENAME,
    connect_db,
    replace_lemma_tables,
    write_manifest,
)


LANG = "ja"
VERSION = "1.0.0"

BASE_DIR = Path(__file__).resolve().parent
RELEASE_DIR = BASE_DIR / "../../releases/ja/ja-v1.0.0"
INPUT_FILE = BASE_DIR / "jpn_wikipedia_2021_300K-sentences.txt"
OUTPUT_DB = RELEASE_DIR / DB_FILENAME
MODEL_DIR = BASE_DIR / "../../backend/models"

MAX_LINES = None

GENERAL_MIN_FREQ = 3
PROPN_MIN_FREQ = 20

TOP_K = 5
MAX_LINE_IDS = 200
WINDOW_SIZE = 2
BATCH_SIZE = 256

STOP_POS = {
    "ADP",
    "AUX",
    "CCONJ",
    "DET",
    "PART",
    "PRON",
    "SCONJ",
    "PUNCT",
    "SYM",
    "X",
}

VALID_RE = re.compile(r"^[0-9A-Za-z\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff々ヶー]+$", re.UNICODE)


def normalize(text: str | None) -> str:
    if text is None:
        return ""

    return unicodedata.normalize("NFC", text).lower().strip()


def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))


def representative_morph(morphs: list[dict]):
    for morph in morphs:
        lemma = morph.get("lemma")
        pos = morph.get("pos")

        if not lemma or not pos or pos in STOP_POS or not valid_lemma(lemma):
            continue

        return morph

    return morphs[0] if morphs else None


def ensure_model():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if not (MODEL_DIR / "ja").exists():
        stanza.download(
            lang="ja",
            model_dir=str(MODEL_DIR),
        )


ensure_model()

nlp = stanza.Pipeline(
    lang="ja",
    processors="tokenize,pos,lemma,depparse",
    use_gpu=False,
    dir=str(MODEL_DIR),
    download_method=None,
)


def _tokens_from_sentence(sent):
    tokens = []

    for token in sent.tokens:
        words = list(getattr(token, "words", []) or [])
        morphs = [
            {
                "surface": word.text,
                "lemma": normalize(word.lemma),
                "pos": word.upos,
                "dep": (word.deprel or "").lower() or None,
            }
            for word in words
        ]

        main = representative_morph(morphs)
        fallback = morphs[0] if morphs else None

        tokens.append({
            "surface": token.text,
            "lemma": main.get("lemma") if main else None,
            "pos": main.get("pos") if main else (fallback.get("pos") if fallback else None),
            "dep": (
                main.get("dep")
                if main and main.get("dep")
                else (fallback.get("dep") if fallback else None)
            ),
            "morphs": morphs,
        })

    return tokens


def analyze_line(raw_line: str):
    doc = nlp(raw_line)

    if not doc.sentences:
        return []

    return _tokens_from_sentence(doc.sentences[0])


def analyze_batch(lines: list[str]):
    if not lines:
        return []

    docs = nlp.bulk_process(lines)
    analyzed = []

    for raw_line, doc in zip(lines, docs):
        if not doc.sentences:
            analyzed.append([])
            continue

        if len(doc.sentences) == 1:
            analyzed.append(_tokens_from_sentence(doc.sentences[0]))
            continue

        merged = []

        for sent in doc.sentences:
            merged.extend(_tokens_from_sentence(sent))

        if not merged:
            analyzed.append(analyze_line(raw_line))
        else:
            analyzed.append(merged)

    return analyzed


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
    analyzed_batch = analyze_batch(batch)

    for tokens in analyzed_batch:
        valid_sequence = []

        for token in tokens:
            for morph in token.get("morphs") or []:
                lemma = morph.get("lemma")
                pos = morph.get("pos")

                if not lemma or not pos or pos in STOP_POS or not valid_lemma(lemma):
                    continue

                key = f"{lemma}_{pos}"
                lemma_freq[key] += 1
                lemma_lines[key].add(line_id)
                valid_sequence.append(key)

        for i, a in enumerate(valid_sequence):
            start = max(0, i - WINDOW_SIZE)
            end = min(len(valid_sequence), i + WINDOW_SIZE + 1)

            for j in range(start, end):
                if i == j:
                    continue

                b = valid_sequence[j]

                if a == b:
                    continue

                contexts[a][b] += 1

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
