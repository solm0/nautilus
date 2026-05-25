import unicodedata

from pathlib import Path
from .sqlite_pack import LanguagePackDB, find_pack_db


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
}


def normalize(text: str):
    return unicodedata.normalize("NFC", text)


def normalize_lemma(lemma: str | None):
    if not lemma:
        return None

    return normalize(lemma).lower().strip() or None


def _representative_morph(morphs: list[dict]):
    for morph in morphs:
        lemma = morph.get("lemma")
        pos = morph.get("pos")

        if not lemma or not pos or pos in STOP_POS:
            continue

        return morph

    return morphs[0] if morphs else None


_nlp = None
_tokenizer = None
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"


def ensure_model():
    import stanza

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    if not (MODEL_DIR / "ja").exists():
        stanza.download(
            lang="ja",
            model_dir=str(MODEL_DIR),
        )


def get_nlp():
    global _nlp

    if _nlp is None:
        import stanza
        ensure_model()

        _nlp = stanza.Pipeline(
            lang="ja",
            processors="tokenize,pos,lemma,depparse",
            use_gpu=False,
            dir=str(MODEL_DIR),
            download_method=None,
        )

    return _nlp


def get_tokenizer():
    global _tokenizer

    if _tokenizer is None:
        import stanza
        ensure_model()

        _tokenizer = stanza.Pipeline(
            lang="ja",
            processors="tokenize",
            use_gpu=False,
            dir=str(MODEL_DIR),
            download_method=None,
        )

    return _tokenizer


def tokenize(text: str):
    doc = get_tokenizer()(text)
    tokens = []

    for sent in doc.sentences:
        for word in sent.words:
            normalized = normalize_lemma(word.text)

            if normalized:
                tokens.append(normalized)

    return tokens


def analyze_text(text: str):
    doc = get_nlp()(text)
    tokens = []

    for sent in doc.sentences:
        for token in sent.tokens:
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

            representative = _representative_morph(morphs)
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


def get_config(base_dir: Path):
    lang_dir = base_dir / "ja"

    from .registry import get_latest_version_path

    version_path = get_latest_version_path(lang_dir)
    db_path = find_pack_db(version_path)
    pack_db = LanguagePackDB(db_path) if db_path else None

    return {
        "normalize": normalize,
        "tokenize": tokenize,
        "get_nlp": get_nlp,
        "analyze_text": analyze_text,
        "pack_db": pack_db,
        "db_path": db_path,
    }
