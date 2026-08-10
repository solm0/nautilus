import re
import unicodedata


KANJI_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff々]")


def normalize(text: str | None) -> str:
    if not text or text == "*":
        return ""

    return unicodedata.normalize("NFC", text).lower().strip()


def contains_kanji(text: str) -> bool:
    return bool(KANJI_RE.search(text))


def katakana_to_hiragana(text: str) -> str:
    converted = []

    for char in text:
        codepoint = ord(char)
        if 0x30A1 <= codepoint <= 0x30F6:
            converted.append(chr(codepoint - 0x60))
        else:
            converted.append(char)

    return "".join(converted)


def _feature_value(feature, name: str) -> str:
    return normalize(getattr(feature, name, None))


def extract_lemma_readings(tagger, text: str) -> list[tuple[str, str]]:
    """Return kanji lemma/readings selected by MeCab for this sentence.

    UniDic distinguishes its lexical lemma from the written base form. Stanza
    can emit either representation, so both are retained as lookup candidates.
    """
    readings: list[tuple[str, str]] = []

    for word in tagger(text):
        feature = word.feature
        candidates = (
            (
                _feature_value(feature, "orthBase"),
                _feature_value(feature, "kanaBase"),
            ),
            (
                _feature_value(feature, "lemma"),
                _feature_value(feature, "lForm"),
            ),
        )
        seen: set[tuple[str, str]] = set()

        for lemma, reading in candidates:
            if not lemma or not reading or not contains_kanji(lemma):
                continue

            pair = (lemma, katakana_to_hiragana(reading))
            if pair in seen:
                continue

            seen.add(pair)
            readings.append(pair)

    return readings
