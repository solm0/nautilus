from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional, Dict, List
import httpx
import os
from dotenv import load_dotenv
from services import lemma_service

load_dotenv()
CENTRAL_API = os.getenv("CENTRAL_API")

router = APIRouter(prefix="/api")

# -----------------------------
# KEY UTIL
# -----------------------------
def to_local_key(lemma: str, pos: str) -> str:
    return f"{lemma}_{pos}"


def to_global_key(lemma: str, pos: str, lang: str) -> str:
    return f"{lemma}/{pos}/{lang}"


def parse_global_key(key: str):
    lemma, pos, lang = key.split("/")
    return lemma, pos, lang


# -----------------------------
# REQUEST MODELS
# -----------------------------
class LookupRequest(BaseModel):
    lemma: str
    pos: str
    language: str


class BatchRequest(BaseModel):
    items: List[dict]
    language: str


# -----------------------------
# CENTRAL CALL
# -----------------------------
def fetch_favorites(token: Optional[str], lemma_keys: List[str]) -> set[str]:
    if not token or not lemma_keys:
        return set()

    res = httpx.post(
        f"{CENTRAL_API}/lemma/favorite/check",
        json={
            "keys": lemma_keys
        },
        headers={
            "Authorization": token
        },
        timeout=5.0
    )

    return set(res.json()["favorites"])


def extract_user(request: Request) -> Optional[dict]:
    """
    Central auth를 로컬이 '대신 구현하지 않고'
    /me 결과를 lightweight하게 reuse하는 방식
    """
    auth = request.headers.get("Authorization")
    if not auth:
        return None

    try:    
        url = f"{CENTRAL_API}/me"
        f"{CENTRAL_API}/me",
        res = httpx.get(
            url = f"{CENTRAL_API}/me",
            headers={"Authorization": auth},
            timeout=3.0
        )

        if res.status_code != 200:
            return None
        return res.json()
    except Exception as e:
        print("EXTRACT USER ERROR", e)
        return None


# -----------------------------
# SINGLE LOOKUP
# -----------------------------
@router.post("/lookup")
def lookup(req: LookupRequest, request: Request):
    user = extract_user(request)

    local_key = to_local_key(req.lemma, req.pos)
    global_key = to_global_key(req.lemma, req.pos, req.language)

    # favorite
    if user:
        fav = fetch_favorites(
            request.headers.get("Authorization"),
            [global_key]
        )
        is_favorite = global_key in fav
    else:
        is_favorite = None

    # local compute
    if not lemma_service.has_key(local_key, req.language):
        return {
            "key": local_key,
            "global_key": global_key,
            "related": [],
            "kwic": [],
            "is_favorite": is_favorite
        }

    related = lemma_service.get_related(local_key, req.language)
    line_ids = lemma_service.get_line_ids(local_key, req.language)

    kwic = lemma_service.sample_kwic(
        line_ids,
        req.lemma,
        req.pos,
        req.language,
        max_k=20
    )

    return {
        "key": local_key,
        "global_key": global_key,
        "related": related,
        "kwic": kwic,
        "is_favorite": is_favorite
    }


# -----------------------------
# BATCH LOOKUP
# -----------------------------
@router.post("/lookup_batch")
def lookup_batch(req: BatchRequest, request: Request):
    user = extract_user(request)

    lang = req.language
    result: Dict[str, dict] = {}

    global_keys = [
        to_global_key(i["lemma"], i["pos"], lang)
        for i in req.items
    ]

    # favorites batch
    if user:
        liked_set = fetch_favorites(
            request.headers.get("Authorization"),
            global_keys
        )
    else:
        liked_set = set()

    # local compute
    for item in req.items:
        lemma = item["lemma"]
        pos = item["pos"]

        local_key = to_local_key(lemma, pos)
        global_key = to_global_key(lemma, pos, lang)

        if not lemma_service.has_key(local_key, lang):
            continue

        result[local_key] = {
            "key": local_key,
            "global_key": global_key,
            "related": lemma_service.get_related(local_key, lang),
            "kwic": lemma_service.sample_kwic(
                lemma_service.get_line_ids(local_key, lang),
                lemma,
                pos,
                lang,
                max_k=10
            ),
            "is_favorite": global_key in liked_set
        }

    return result