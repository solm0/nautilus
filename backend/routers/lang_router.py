from fastapi import APIRouter, BackgroundTasks
import uuid
import httpx
import os
from dotenv import load_dotenv
load_dotenv()
from services.installer import (
    get_install_state,
    install_pack,
    uninstall_pack,
    progress_map,
)

router = APIRouter(prefix="/api/lang", tags=["lang"])

CENTRAL_API = os.getenv("CENTRAL_API")
TARGET_PACK_VERSION = "1.1.0"


# -----------------------------
# PACK LIST FROM CENTRAL
# -----------------------------

def fetch_packs():
    with httpx.Client(http2=False, timeout=10.0) as client:
        res = client.get(f"{CENTRAL_API}/lang/packs")
        res.raise_for_status()
        packs = res.json()

    result = []

    for pack in packs:
        normalized = {
            **pack,
            "version": TARGET_PACK_VERSION,
            "tag": f"v{TARGET_PACK_VERSION}",
            "lemma_filename": f"{pack['lang']}-v{TARGET_PACK_VERSION}-lemma.zip",
            "ngram_filename": f"{pack['lang']}-v{TARGET_PACK_VERSION}-ngram.zip",
        }
        result.append(normalized)

    return result

# -----------------------------
# INSTALLED STATUS
# -----------------------------
@router.get("/installed")
def get_installed():
    packs = fetch_packs()

    result = []

    for p in packs:
        state = get_install_state(p["lang"], p["version"])

        result.append({
            "lang": p["lang"],
            "version": p["version"],
            **state,
        })

    return result


# -----------------------------
# INSTALL
# -----------------------------
@router.post("/install")
def install(data: dict, bg: BackgroundTasks):
    task_id = str(uuid.uuid4())

    def job():
        install_pack(
            data["lang"],
            data["version"],
            data.get("filename"),
            data.get("asset_kind", "lemma"),
            task_id
        )

    bg.add_task(job)

    return {"task_id": task_id}


# -----------------------------
# UNINSTALL
# -----------------------------
@router.post("/uninstall")
def uninstall(data: dict):
    uninstall_pack(data["lang"], data["version"])
    return {"status": "ok"}


# -----------------------------
# PROGRESS
# -----------------------------
@router.get("/progress/{task_id}")
def progress(task_id: str):
    return progress_map.get(task_id, {
        "progress": 0,
        "status": "unknown"
    })
