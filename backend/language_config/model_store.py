from __future__ import annotations

import shutil
from pathlib import Path

from runtime_paths import get_backend_root


BASE_DIR = get_backend_root()
STANZA_MODEL_DIR = BASE_DIR / "models"
CLASSLA_MODEL_DIR = BASE_DIR / "classla_models"

CLASSLA_LANGS = {"sr", "mk"}
STANZA_LANGS = {"de", "en", "ja", "ko", "ru", "sq"}


def _legacy_stanza_root() -> Path | None:
    try:
        from stanza.resources.common import DEFAULT_MODEL_DIR
    except Exception:
        return None

    return Path(DEFAULT_MODEL_DIR)


def _legacy_classla_root() -> Path | None:
    try:
        from classla.resources.common import DEFAULT_MODEL_DIR
    except Exception:
        return None

    return Path(DEFAULT_MODEL_DIR)


def _lang_path(root: Path | None, lang: str) -> Path | None:
    if root is None:
        return None

    return root / lang


def get_local_model_dir(lang: str) -> Path:
    if lang in CLASSLA_LANGS:
        return CLASSLA_MODEL_DIR

    return STANZA_MODEL_DIR


def get_local_model_path(lang: str) -> Path:
    return get_local_model_dir(lang) / lang


def get_legacy_model_path(lang: str) -> Path | None:
    if lang in CLASSLA_LANGS:
        return _lang_path(_legacy_classla_root(), lang)

    if lang in STANZA_LANGS:
        return _lang_path(_legacy_stanza_root(), lang)

    return None


def resolve_model_dir(lang: str) -> Path:
    local_dir = get_local_model_dir(lang)
    local_path = local_dir / lang

    if local_path.exists():
        return local_dir

    legacy_path = get_legacy_model_path(lang)

    if legacy_path and legacy_path.exists():
        return legacy_path.parent

    return local_dir


def ensure_model_installed(lang: str) -> Path:
    local_dir = get_local_model_dir(lang)
    local_path = local_dir / lang

    if local_path.exists():
        return local_dir

    legacy_path = get_legacy_model_path(lang)

    if legacy_path and legacy_path.exists():
        return legacy_path.parent

    local_dir.mkdir(parents=True, exist_ok=True)

    if lang in CLASSLA_LANGS:
        import classla

        classla.download(lang, dir=str(local_dir))
        return local_dir

    import stanza

    stanza.download(lang, model_dir=str(local_dir))
    return local_dir


def model_installed(lang: str) -> bool:
    if get_local_model_path(lang).exists():
        return True

    legacy_path = get_legacy_model_path(lang)
    return bool(legacy_path and legacy_path.exists())


def remove_models(lang: str):
    paths = [get_local_model_path(lang), get_legacy_model_path(lang)]

    for path in paths:
        if path and path.exists():
            shutil.rmtree(path, ignore_errors=True)
