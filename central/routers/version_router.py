import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent.parent
LATEST_VERSION_PATHS = {
    "desktop": BASE_DIR / "static" / "latest-version-desktop.json",
    "android": BASE_DIR / "static" / "latest-version-android.json",
}

router = APIRouter(prefix="/api", tags=["version"])


class LatestVersionResponse(BaseModel):
    platform: Literal["desktop", "android"]
    version: str
    download_url: str
    notes: list[str]


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
