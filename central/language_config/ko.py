import re
import unicodedata
from pathlib import Path

from .sqlite_pack import LanguagePackDB, find_pack_db


TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]+(?:[-'][0-9A-Za-z가-힣]+)*", re.UNICODE)

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

KO_STOP_UPOS = {
    "ADP",
    "AUX",
    "CCONJ",
    "DET",
    "PART",
    "PRON",
    "SCONJ",
    "PUNCT",
    "SYM",
}


def normalize(text: str):
    return unicodedata.normalize("NFC", text)


def normalize_lemma(lemma: str | None):
    if not lemma:
        return None

    return normalize(lemma).lower().strip() or None


def tokenize(text: str):
    return TOKEN_RE.findall(normalize(text).lower())


def map_kiwi_tag(tag: str, lemma: str | None = None, surface: str | None = None):
    if tag == "MAG" and lemma == "다" and surface == "다":
        return "PART"

    return KIWI_TAG_TO_UPOS.get(tag, "X")


def is_clickable_morph(pos: str | None):
    return bool(pos) and pos not in KO_STOP_UPOS and pos != "X"


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

        lemma = normalize_lemma(getattr(item, "lemma", None))
        pos = map_kiwi_tag(item.tag, lemma=lemma, surface=display_surface)

        morphs.append({
            "surface": display_surface,
            "lemma": lemma,
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
        if is_clickable_morph(morph.get("pos")) and morph.get("lemma"):
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


_nlp = None
_kiwi = None


def get_nlp():
    global _nlp

    if _nlp is None:
        import stanza

        _nlp = stanza.Pipeline(
            lang="ko",
            processors="tokenize,pos,lemma,depparse",
            use_gpu=False,
            download_method=None,
        )

    return _nlp


def get_kiwi():
    global _kiwi

    if _kiwi is None:
        from kiwipiepy import Kiwi

        _kiwi = Kiwi()

    return _kiwi


def analyze_text(text: str):
    doc = get_nlp()(text)
    kiwi_tokens = get_kiwi().tokenize(text)

    tokens = []

    for sent in doc.sentences:
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


def get_config(base_dir: Path):
    lang_dir = base_dir / "ko"

    from .registry import get_latest_version_path

    version_path = get_latest_version_path(lang_dir)
    db_path = find_pack_db(version_path)

    return {
        "normalize": normalize,
        "tokenize": tokenize,
        "get_nlp": get_nlp,
        "analyze_text": analyze_text,
        "pack_db": LanguagePackDB(db_path) if db_path else None,
        "db_path": db_path,
    }
