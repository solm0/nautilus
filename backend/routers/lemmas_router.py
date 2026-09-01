import hashlib
import os
import time
from typing import Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from services import lemma_service


load_dotenv()
CENTRAL_API = os.getenv("CENTRAL_API")
PROFILE_CACHE_TTL_SECONDS = 30.0

router = APIRouter(prefix="/api")
_profile_cache: dict[str, tuple[float, dict[str, dict]]] = {}


def to_local_key(lemma: str, pos: str) -> str:
    return f"{lemma}_{pos}"


def to_global_key(lemma: str, pos: str, lang: str) -> str:
    return f"{lemma}/{pos}/{lang}"


class LookupRequest(BaseModel):
    lemma: str
    pos: str
    language: str


class BatchRequest(BaseModel):
    items: List[dict] = Field(max_length=100)
    language: str


def fetch_user_lemma_states(token: Optional[str]) -> dict[str, dict]:
    if not token or not CENTRAL_API:
        return {}

    cache_key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    cached = _profile_cache.get(cache_key)
    if cached and now - cached[0] < PROFILE_CACHE_TTL_SECONDS:
        return cached[1]

    try:
        response = httpx.get(
            f"{CENTRAL_API}/lemma/profile",
            headers={"Authorization": token},
            timeout=5.0,
        )
        response.raise_for_status()
        items = response.json().get("items", [])
        states = {
            item["key"]: {
                "exposure_count": min(max(int(item.get("exposure_count") or 0), 0), 10),
                "is_known": item.get("is_known") is True,
                "is_interested": item.get("is_interested") is True,
            }
            for item in items
            if isinstance(item, dict) and isinstance(item.get("key"), str)
        }
        _profile_cache[cache_key] = (now, states)
        return states
    except (httpx.HTTPError, TypeError, ValueError):
        return cached[1] if cached else {}


@router.post("/lookup")
def lookup(req: LookupRequest, request: Request):
    local_key = to_local_key(req.lemma, req.pos)
    global_key = to_global_key(req.lemma, req.pos, req.language)
    states = fetch_user_lemma_states(request.headers.get("Authorization"))
    is_interested = bool(states.get(global_key, {}).get("is_interested"))

    if not lemma_service.has_key(local_key, req.language):
        return {
            "key": local_key,
            "global_key": global_key,
            "found": False,
            "kwic": [],
            "furigana": None,
            "is_interested": is_interested,
            "is_favorite": is_interested,
        }

    kwic = lemma_service.sample_kwic(
        lemma_service.get_line_ids(local_key, req.language),
        req.lemma,
        req.pos,
        req.language,
        user_lemma_states=states,
    )

    return {
        "key": local_key,
        "global_key": global_key,
        "found": True,
        "kwic": kwic,
        "furigana": lemma_service.get_furigana(local_key, req.language),
        "is_interested": is_interested,
        "is_favorite": is_interested,
    }


@router.post("/lookup_batch")
def lookup_batch(req: BatchRequest, request: Request):
    lang = req.language
    result: Dict[str, dict] = {}
    states = fetch_user_lemma_states(request.headers.get("Authorization"))

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
            "found": True,
            "furigana": lemma_service.get_furigana(local_key, lang),
            "kwic": lemma_service.sample_kwic(
                lemma_service.get_line_ids(local_key, lang),
                lemma,
                pos,
                lang,
                user_lemma_states=states,
            ),
            "is_interested": bool(states.get(global_key, {}).get("is_interested")),
            "is_favorite": bool(states.get(global_key, {}).get("is_interested")),
        }

    return result
