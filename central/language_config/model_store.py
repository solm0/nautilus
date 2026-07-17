from __future__ import annotations

from pathlib import Path

import bootstrap_paths  # noqa: F401
from shared.manifests import get_model_provider

BASE_DIR = Path(__file__).resolve().parent.parent
STANZA_MODEL_DIR = BASE_DIR / "models"
CLASSLA_MODEL_DIR = BASE_DIR / "classla_models"


def get_model_dir(lang: str) -> Path:
    if get_model_provider(lang) == "classla":
        return CLASSLA_MODEL_DIR

    return STANZA_MODEL_DIR


def get_model_path(lang: str) -> Path:
    return get_model_dir(lang) / lang


def model_exists(lang: str) -> bool:
    return get_model_path(lang).exists()


def ensure_model_directories():
    STANZA_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    CLASSLA_MODEL_DIR.mkdir(parents=True, exist_ok=True)


def download_model(lang: str):
    model_dir = get_model_dir(lang)

    if get_model_provider(lang) == "classla":
        import classla

        classla.download(lang, dir=str(model_dir), processors="tokenize,pos,lemma")
        return

    import stanza

    stanza.download(lang, model_dir=str(model_dir), processors="tokenize,pos,lemma")
