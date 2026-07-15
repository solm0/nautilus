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
