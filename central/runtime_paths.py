from __future__ import annotations

from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


def get_runtime_root() -> Path:
    return BASE_DIR / "data_runtime"


def get_runtime_state_root() -> Path:
    return get_runtime_root() / "state"
