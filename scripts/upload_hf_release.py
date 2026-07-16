#!/usr/bin/env python3

from __future__ import annotations

import os
import sys
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_url


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def main() -> int:
    repo_id = require_env("HF_REPO_ID")
    repo_type = os.environ.get("HF_REPO_TYPE", "dataset").strip() or "dataset"
    token = require_env("HF_TOKEN")
    tag = require_env("GITHUB_REF_NAME")
    release_platform = require_env("RELEASE_PLATFORM")

    assets_dir = Path("release-assets")
    if not assets_dir.is_dir():
        raise SystemExit(f"Release assets directory not found: {assets_dir}")

    files = sorted(path for path in assets_dir.rglob("*") if path.is_file())
    if not files:
        raise SystemExit(f"No files found under {assets_dir}")

    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type=repo_type, private=False, exist_ok=True)

    path_in_repo = f"releases/{release_platform}/{tag}"
    api.upload_folder(
        folder_path=str(assets_dir),
        path_in_repo=path_in_repo,
        repo_id=repo_id,
        repo_type=repo_type,
        commit_message=f"Upload {release_platform} release assets for {tag}",
    )

    print(f"Uploaded {len(files)} file(s) to {repo_type} repo {repo_id}")
    for file_path in files:
        relative = file_path.relative_to(assets_dir).as_posix()
        url = hf_hub_url(
            repo_id=repo_id,
            repo_type=repo_type,
            revision="main",
            filename=f"{path_in_repo}/{relative}",
        )
        print(url)

    return 0


if __name__ == "__main__":
    sys.exit(main())
