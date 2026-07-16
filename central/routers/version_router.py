import json
import re
import time
from pathlib import Path
from typing import Any, Literal

import requests
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent.parent
LATEST_VERSION_PATHS = {
    "desktop": BASE_DIR / "static" / "latest-version-desktop.json",
    "android": BASE_DIR / "static" / "latest-version-android.json",
}
HF_REPO_ID = "solm0/nautilus-releases"
HF_REPO_TYPE = "dataset"
HF_API_BASE = "https://huggingface.co/api"
HF_RESOLVE_BASE = f"https://huggingface.co/datasets/{HF_REPO_ID}/resolve/main"
DESKTOP_TAG_PATTERN = re.compile(r"^app-desktop-v(?P<version>\d+\.\d+\.\d+)$")
ANDROID_TAG_PATTERN = re.compile(r"^app-android-v(?P<version>\d+\.\d+\.\d+)$")
RELEASE_CACHE_TTL_SECONDS = 300

_release_cache: dict[str, Any] = {
    "expires_at": 0.0,
    "payload": None,
}

router = APIRouter(prefix="/api", tags=["version"])


class LatestVersionResponse(BaseModel):
    platform: Literal["desktop", "android"]
    version: str
    download_url: str
    notes: list[str]


class DesktopReleaseResponse(BaseModel):
    version: str
    tag: str
    platforms: dict[str, str]


class AndroidReleaseResponse(BaseModel):
    version: str
    tag: str
    href: str


class ReleaseCatalogResponse(BaseModel):
    desktop: list[DesktopReleaseResponse]
    android: list[AndroidReleaseResponse]


def compare_versions_desc(version: str):
    return tuple(int(part) for part in version.split("."))


def build_hf_resolve_url(path_in_repo: str):
    return f"{HF_RESOLVE_BASE}/{path_in_repo}"


def fetch_hf_release_tree():
    response = requests.get(
        f"{HF_API_BASE}/datasets/{HF_REPO_ID}/tree/main/releases",
        params={"recursive": "1", "expand": "0"},
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def build_release_catalog_from_tree(entries: list[dict[str, Any]]):
    desktop_releases: dict[str, dict[str, Any]] = {}
    android_releases: dict[str, dict[str, Any]] = {}

    for entry in entries:
        if entry.get("type") != "file":
            continue

        path = entry.get("path")
        if not isinstance(path, str):
            continue

        parts = path.split("/")
        if len(parts) < 4 or parts[0] != "releases":
            continue

        platform = parts[1]
        tag = parts[2]

        if platform == "desktop" and len(parts) >= 5:
            match = DESKTOP_TAG_PATTERN.match(tag)
            if not match:
                continue

            version = match.group("version")
            artifact_folder = parts[3]
            filename = parts[-1]

            platform_key = {
                "nautilus-electron-macos": "macOS",
                "nautilus-electron-linux": "Linux",
                "nautilus-electron-windows": "Windows",
            }.get(artifact_folder)

            if platform_key is None:
                continue

            if platform_key == "macOS" and not filename.endswith(".dmg"):
                continue

            if platform_key == "Linux" and not (
                filename.endswith(".AppImage") or filename.endswith(".dmg")
            ):
                continue

            if platform_key == "Windows" and not (
                filename.endswith(".exe") or filename.endswith(".dmg")
            ):
                continue

            desktop_release = desktop_releases.setdefault(
                version,
                {
                    "version": version,
                    "tag": tag,
                    "platforms": {},
                },
            )
            desktop_release["platforms"][platform_key] = build_hf_resolve_url(path)

        if platform == "android" and len(parts) >= 4:
            match = ANDROID_TAG_PATTERN.match(tag)
            if not match:
                continue

            version = match.group("version")
            filename = parts[-1]

            if not filename.endswith(".apk"):
                continue

            android_releases[version] = {
                "version": version,
                "tag": tag,
                "href": build_hf_resolve_url(path),
            }

    desktop = sorted(
        (
            release
            for release in desktop_releases.values()
            if release["platforms"]
        ),
        key=lambda release: compare_versions_desc(release["version"]),
        reverse=True,
    )
    android = sorted(
        android_releases.values(),
        key=lambda release: compare_versions_desc(release["version"]),
        reverse=True,
    )

    return {
        "desktop": desktop,
        "android": android,
    }


def load_release_catalog():
    now = time.time()
    if _release_cache["payload"] is not None and now < _release_cache["expires_at"]:
        return _release_cache["payload"]

    payload = build_release_catalog_from_tree(fetch_hf_release_tree())
    _release_cache["payload"] = payload
    _release_cache["expires_at"] = now + RELEASE_CACHE_TTL_SECONDS
    return payload


@router.get("/latest-version", response_model=LatestVersionResponse)
def get_latest_version(
    platform: Literal["desktop", "android"] = Query(default="desktop"),
):
    path = LATEST_VERSION_PATHS[platform]
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"latest version payload for {platform} is not configured",
        )

    payload = json.loads(path.read_text(encoding="utf-8"))
    payload.setdefault("platform", platform)
    return LatestVersionResponse(**payload)


@router.get("/releases", response_model=ReleaseCatalogResponse)
def get_release_catalog():
    try:
        payload = load_release_catalog()
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not load release catalog from Hugging Face: {exc}",
        ) from exc

    return ReleaseCatalogResponse(**payload)
