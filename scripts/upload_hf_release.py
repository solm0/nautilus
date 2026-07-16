#!/usr/bin/env python3

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_url
from huggingface_hub.errors import HfHubHTTPError
import httpx


MAX_RETRIES = 4
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def is_retryable_error(exc: Exception) -> bool:
    if isinstance(exc, HfHubHTTPError):
        status_code = exc.response.status_code if exc.response is not None else None
        return status_code in RETRYABLE_STATUS_CODES

    return isinstance(exc, (httpx.HTTPError, TimeoutError))


def call_with_retry(label: str, fn, *args, **kwargs):
    delay = 2.0

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            if attempt >= MAX_RETRIES or not is_retryable_error(exc):
                raise

            print(
                f"{label} failed on attempt {attempt}/{MAX_RETRIES} with "
                f"{exc.__class__.__name__}: {exc}. Retrying in {delay:.0f}s...",
                file=sys.stderr,
            )
            time.sleep(delay)
            delay *= 2


def ensure_repo_exists(api: HfApi, repo_id: str, repo_type: str) -> None:
    try:
        call_with_retry(
            "create_repo",
            api.create_repo,
            repo_id=repo_id,
            repo_type=repo_type,
            private=False,
            exist_ok=True,
        )
        return
    except Exception as exc:
        if not is_retryable_error(exc):
            raise

        print(
            "create_repo still failed after retries. Checking whether the repo "
            "was created despite the timeout...",
            file=sys.stderr,
        )
        call_with_retry(
            "repo_info",
            api.repo_info,
            repo_id=repo_id,
            repo_type=repo_type,
        )


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
    ensure_repo_exists(api, repo_id=repo_id, repo_type=repo_type)

    path_in_repo = f"releases/{release_platform}/{tag}"
    call_with_retry(
        "upload_folder",
        api.upload_folder,
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
