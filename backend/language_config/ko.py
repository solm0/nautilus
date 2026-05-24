import re
import unicodedata
from pathlib import Path

from .sqlite_pack import LanguagePackDB, find_pack_db


TOKEN_RE = re.compile(r"[0-9A-Za-z가-힣]+(?:[-'][0-9A-Za-z가-힣]+)*", re.UNICODE)


def normalize(text: str):
    return unicodedata.normalize("NFC", text)


def tokenize(text: str):
    return TOKEN_RE.findall(normalize(text).lower())


_nlp = None
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"


def get_nlp():
    global _nlp

    if _nlp is None:
        import stanza

        _nlp = stanza.Pipeline(
            lang="ko",
            processors="tokenize,pos,lemma,depparse",
            use_gpu=False,
            dir=str(MODEL_DIR),
            download_method=None,
        )

    return _nlp


def analyze_text(text: str):
    doc = get_nlp()(text)

    from shared.services.nlp_service import align_tokens

    tokens = []
    for sent in doc.sentences:
        tokens.extend(align_tokens(sent, "ko"))

    return tokens


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
