from __future__ import annotations

import os
import sys
from pathlib import Path


def get_backend_root() -> Path:
    override = os.getenv("NAUTILUS_BACKEND_ROOT")

    if override:
        return Path(override).resolve()

    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent

    return Path(__file__).resolve().parent


def _resolve_override(name: str) -> Path | None:
    value = os.getenv(name)
    if not value:
        return None

    return Path(value).resolve()


def get_static_data_root() -> Path:
    override = _resolve_override("NAUTILUS_DATA_STATIC_ROOT")

    if override is not None:
        return override

    return get_backend_root() / "data" / "static"


def get_stanza_model_root() -> Path:
    override = _resolve_override("NAUTILUS_STANZA_MODEL_ROOT")

    if override is not None:
        return override

    return get_backend_root() / "models"


def get_classla_model_root() -> Path:
    override = _resolve_override("NAUTILUS_CLASSLA_MODEL_ROOT")

    if override is not None:
        return override

    return get_backend_root() / "classla_models"


def get_frontend_dist_dir() -> Path | None:
    override = os.getenv("NAUTILUS_FRONTEND_DIST")

    if override:
        path = Path(override).resolve()
        return path if path.exists() else None

    candidates = [
        get_backend_root() / "frontend",
        get_backend_root().parent / "frontend" / "dist",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None
