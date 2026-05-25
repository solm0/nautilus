import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import stanza
from kiwipiepy import Kiwi

PREPROCESS_DIR = Path(__file__).resolve().parents[1]
if str(PREPROCESS_DIR) not in sys.path:
    sys.path.append(str(PREPROCESS_DIR))

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
WINDOW_SIZE = 2
BATCH_SIZE = 64

KIWI_TAG_TO_UPOS = {
    "NNG": "NOUN",
    "NNP": "PROPN",
    "NNB": "NOUN",
    "NP": "PRON",
    "NR": "NUM",
    "XR": "NOUN",
    "VV": "VERB",
    "VA": "ADJ",
    "VX": "AUX",
    "VCP": "AUX",
    "VCN": "ADJ",
    "MM": "DET",
    "MAG": "ADV",
    "MAJ": "CCONJ",
    "IC": "INTJ",
    "JKS": "ADP",
    "JKC": "ADP",
    "JKG": "ADP",
    "JKO": "ADP",
    "JKB": "ADP",
    "JKV": "ADP",
    "JKQ": "ADP",
    "JX": "PART",
    "JC": "CCONJ",
    "EP": "AUX",
    "EF": "PART",
    "EC": "SCONJ",
    "ETN": "PART",
    "ETM": "PART",
    "XPN": "PART",
    "XSN": "NOUN",
    "XSV": "AUX",
    "XSA": "AUX",
    "SF": "PUNCT",
    "SP": "PUNCT",
    "SS": "PUNCT",
    "SE": "PUNCT",
    "SO": "PUNCT",
    "SW": "SYM",
    "SL": "X",
    "SH": "X",
    "SN": "NUM",
}

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

VALID_RE = re.compile(r"^[0-9a-z가-힣]+$", re.UNICODE)


def normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text).lower().strip()


def valid_lemma(lemma: str) -> bool:
    return bool(VALID_RE.fullmatch(lemma))


def map_kiwi_tag(tag: str, lemma: str | None = None, surface: str | None = None):
    if tag == "MAG" and lemma == "다" and surface == "다":
        return "PART"

    return KIWI_TAG_TO_UPOS.get(tag, "X")


def build_display_morphs(surface: str, kiwi_tokens, token_start: int):
    surface_chars = list(surface)
    occupied = set()
    morphs = []

    ordered = sorted(kiwi_tokens, key=lambda item: (item.start, item.len))

    for item in ordered:
        local_start = max(0, item.start - token_start)
        local_end = min(len(surface_chars), local_start + item.len)

        indices = [
            index
            for index in range(local_start, local_end)
            if index not in occupied
        ]

        if not indices:
            continue

        display_surface = "".join(surface_chars[index] for index in indices)

        for index in indices:
            occupied.add(index)

        lemma = normalize(getattr(item, "lemma", ""))
        pos = map_kiwi_tag(item.tag, lemma=lemma, surface=display_surface)

        morphs.append({
            "surface": display_surface,
            "lemma": lemma or None,
            "pos": pos,
            "dep": None,
            "_start": indices[0],
            "_end": indices[-1] + 1,
        })

    if not morphs:
        morphs.append({
            "surface": surface,
            "lemma": None,
            "pos": None,
            "dep": None,
        })
        return morphs

    index = 0

    while index < len(surface_chars):
        if index in occupied:
            index += 1
            continue

        start = index

        while index < len(surface_chars) and index not in occupied:
            index += 1

        chunk = "".join(surface_chars[start:index])

        target_index = None

        for morph_index, morph in enumerate(morphs):
            if morph["_end"] <= start:
                target_index = morph_index
            else:
                break

        if target_index is None:
            morphs[0]["surface"] = chunk + morphs[0]["surface"]
            morphs[0]["_start"] = start
        else:
            morphs[target_index]["surface"] += chunk
            morphs[target_index]["_end"] = index

    for morph in morphs:
        morph.pop("_start", None)
        morph.pop("_end", None)

    return morphs


def representative_morph(morphs: list[dict]):
    for morph in morphs:
        lemma = morph.get("lemma")
        pos = morph.get("pos")

        if not lemma or not pos or pos in STOP_POS or not valid_lemma(lemma):
            continue

        return morph

    return morphs[0] if morphs else None


def is_punctuation_token(token: dict):
    morphs = token.get("morphs") or []

    if not morphs:
        return False

    for morph in morphs:
        pos = morph.get("pos")

        if pos not in {"PUNCT", "SYM", None}:
            return False

    return True


def merge_punctuation_tokens(tokens: list[dict]):
    merged = []

    for token in tokens:
        if merged and is_punctuation_token(token):
            merged[-1]["surface"] += token["surface"]

            if merged[-1].get("morphs"):
                merged[-1]["morphs"][-1]["surface"] += token["surface"]
            else:
                merged[-1]["morphs"] = token.get("morphs") or []

            continue

        merged.append(token)

    return merged


nlp = stanza.Pipeline(
    lang="ko",
    processors="tokenize,pos,lemma,depparse",
    use_gpu=False,
    download_method=None,
)

kiwi = Kiwi()


def _tokens_from_sentence(sent, raw_line: str):
    kiwi_tokens = kiwi.tokenize(raw_line)
    tokens = []

    for token in sent.tokens:
        surface = token.text
        start = getattr(token, "start_char", None)
        end = getattr(token, "end_char", None)

        matched = []

        if start is not None and end is not None:
            matched = [
                item
                for item in kiwi_tokens
                if start <= item.start < end
            ]

        morphs = build_display_morphs(surface, matched, start or 0)
        main = representative_morph(morphs)
        first_word = token.words[0] if token.words else None

        tokens.append({
            "surface": surface,
            "lemma": main.get("lemma") if main else None,
            "pos": main.get("pos") if main else None,
            "dep": (first_word.deprel or "").lower() if first_word and first_word.deprel else None,
            "morphs": morphs,
        })

    return merge_punctuation_tokens(tokens)


def analyze_line(raw_line: str):
    doc = nlp(raw_line)

    if not doc.sentences:
        return []

    return _tokens_from_sentence(doc.sentences[0], raw_line)


def analyze_batch(lines: list[str]):
    if not lines:
        return []

    doc = nlp("\n\n".join(lines))

    if len(doc.sentences) != len(lines):
        return [analyze_line(line) for line in lines]

    return [
        _tokens_from_sentence(sent, raw_line)
        for raw_line, sent in zip(lines, doc.sentences)
    ]

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
    batch = lines_raw[
        batch_start : batch_start + BATCH_SIZE
    ]
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
