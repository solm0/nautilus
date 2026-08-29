import unicodedata

from pathlib import Path
from .model_store import ensure_model_installed
from .sqlite_pack import LanguagePackDB, find_pack_db


# =====================
# NORMALIZE
# =====================
def normalize(text: str):
    return unicodedata.normalize("NFC", text)


# =====================
# LAZY LOADERS
# =====================
_nlp = None


def get_nlp():

    global _nlp

    if _nlp is None:
        import stanza

        model_dir = ensure_model_installed("de")
        _nlp = stanza.Pipeline(
            lang="de",
            processors="tokenize,pos,lemma",
            use_gpu=False,
            dir=str(model_dir),
            download_method=None,
        )

    return _nlp


# =====================
# CONFIG
# =====================
def get_config(base_dir: Path):

    lang_dir = base_dir / "de"

    from .registry import get_latest_version_path

    version_path = get_latest_version_path(lang_dir)
    db_path = find_pack_db(version_path)
    pack_db = LanguagePackDB(db_path) if db_path else None

    return {
        "normalize": normalize,
        "get_nlp": get_nlp,

        "pack_db": pack_db,
        "db_path": db_path,
    }


def unload():
    global _nlp

    _nlp = None
