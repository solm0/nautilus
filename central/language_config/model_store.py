from __future__ import annotations

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
STANZA_MODEL_DIR = BASE_DIR / "models"
CLASSLA_MODEL_DIR = BASE_DIR / "classla_models"

CLASSLA_LANGS = {"sr", "mk"}


def get_model_dir(lang: str) -> Path:
    if lang in CLASSLA_LANGS:
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

    if lang in CLASSLA_LANGS:
        import classla

        classla.download(lang, dir=str(model_dir))
        return

    import stanza

    stanza.download(lang, model_dir=str(model_dir))
