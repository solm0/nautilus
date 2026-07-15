import json
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent.parent
LATEST_VERSION_PATH = BASE_DIR / "static" / "latest-version.json"

router = APIRouter(prefix="/api", tags=["version"])


class LatestVersionResponse(BaseModel):
    version: str
    download_url: str
    notes: list[str]


@router.get("/latest-version", response_model=LatestVersionResponse)
def get_latest_version():
    payload = json.loads(LATEST_VERSION_PATH.read_text(encoding="utf-8"))
    return LatestVersionResponse(**payload)
