from __future__ import annotations

import unicodedata


BASE_STOP_POS = {
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

LANGUAGE_STOP_POS = {
    "ja": BASE_STOP_POS | {"AUX"},
    "ko": BASE_STOP_POS | {"AUX"},
    "sr": BASE_STOP_POS | {"AUX", "X"},
}


def normalize_lemma(lemma: str | None) -> str | None:
    if not lemma:
        return None

    return unicodedata.normalize("NFC", lemma).lower().strip() or None


def is_stop_pos(pos: str | None, language: str) -> bool:
    if not pos:
        return False

    stop_pos = LANGUAGE_STOP_POS.get(language, BASE_STOP_POS)
    return pos in stop_pos


def _representative_morph(morphs: list[dict], language: str):
    for morph in morphs:
        lemma = morph.get("lemma")
        pos = morph.get("pos")

        if not lemma or not pos or is_stop_pos(pos, language):
            continue

        return morph

    return None


def _align_korean_tokens(sent):
    tokens = []

    for token in getattr(sent, "tokens", []):
        words = list(getattr(token, "words", []) or [])
        morphs = [
            {
                "surface": word.text,
                "lemma": normalize_lemma(word.lemma),
                "pos": word.upos,
                "dep": (word.deprel or "").lower() or None,
            }
            for word in words
        ]

        representative = _representative_morph(morphs, "ko")
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

    return tokens


def align_tokens(sent, language: str):
    if language == "ko":
        return _align_korean_tokens(sent)

    split_tokens = sent.text.split()
    stanza_words = sent.words

    tokens = []
    w_idx = 0

    for split_tok in split_tokens:
        buffer = ""
        matched_words = []

        while w_idx < len(stanza_words):
            w = stanza_words[w_idx]
            buffer += w.text
            matched_words.append(w)
            w_idx += 1

            if buffer == split_tok:
                break

        if buffer == split_tok and matched_words:
            main = matched_words[0]
            tokens.append({
                "surface": split_tok,
                "lemma": normalize_lemma(main.lemma),
                "pos": main.upos,
                "dep": (main.deprel or "").lower() or None,
            })
        else:
            tokens.append({
                "surface": split_tok,
                "lemma": None,
                "pos": None,
                "dep": None,
            })

    return tokens


def analyze_text(text: str, language: str):
    from language_config import get_config

    cfg = get_config(language)
    analyze = cfg.get("analyze_text")

    if callable(analyze):
        return analyze(text)

    nlp = cfg["get_nlp"]()
    doc = nlp(text)

    tokens = []
    for sent in doc.sentences:
        tokens.extend(align_tokens(sent, language))

    return tokens
