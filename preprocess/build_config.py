import os
from pathlib import Path


VERSION_ENV_VAR = "NAUTILUS_PACK_VERSION"


def get_version(default: str) -> str:
    return os.getenv(VERSION_ENV_VAR, default).strip() or default


def get_release_dir(base_dir: Path, lang: str, version: str) -> Path:
    return base_dir / f"../../releases/{lang}/{lang}-v{version}"
