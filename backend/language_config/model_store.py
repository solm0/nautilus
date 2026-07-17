from __future__ import annotations

import shutil
from pathlib import Path

from runtime_paths import get_classla_model_root, get_stanza_model_root
from shared.manifests import get_model_provider


STANZA_MODEL_DIR = get_stanza_model_root()
CLASSLA_MODEL_DIR = get_classla_model_root()


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
    if get_model_provider(lang) == "classla":
        return CLASSLA_MODEL_DIR

    return STANZA_MODEL_DIR


def get_local_model_path(lang: str) -> Path:
    return get_local_model_dir(lang) / lang


def get_legacy_model_path(lang: str) -> Path | None:
    provider = get_model_provider(lang)

    if provider == "classla":
        return _lang_path(_legacy_classla_root(), lang)

    if provider == "stanza":
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

    if get_model_provider(lang) == "classla":
        import classla

        classla.download(lang, dir=str(local_dir), processors="tokenize,pos,lemma")
        return local_dir

    import stanza

    stanza.download(lang, model_dir=str(local_dir), processors="tokenize,pos,lemma")
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
