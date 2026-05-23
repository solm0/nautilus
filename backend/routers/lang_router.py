from fastapi import APIRouter, BackgroundTasks
import uuid
import httpx
import os
from dotenv import load_dotenv
load_dotenv()
from services.installer import install_pack, uninstall_pack, progress_map, is_installed

router = APIRouter(prefix="/api/lang", tags=["lang"])

CENTRAL_API = os.getenv("CENTRAL_API")


# -----------------------------
# PACK LIST FROM CENTRAL
# -----------------------------

def fetch_packs():
    with httpx.Client(http2=False, timeout=10.0) as client:
        res = client.get(f"{CENTRAL_API}/lang/packs")
        res.raise_for_status()
        return res.json()

# -----------------------------
# INSTALLED STATUS
# -----------------------------
@router.get("/installed")
def get_installed():
    packs = fetch_packs()

    result = []

    for p in packs:
        installed = is_installed(p["lang"], p["version"])

        result.append({
            "lang": p["lang"],
            "version": p["version"],
            "installed": installed,
            "ocr_supported": p["ocr_supported"]
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
