from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from services import pattern_service


router = APIRouter(prefix="/api/pattern", tags=["pattern"])


class PatternSearchRequest(BaseModel):
    query_language: str
    search_languages: list[str]
    tokens: list[dict[str, Any]]
    limit: int = 20


@router.post("/search")
def search_pattern(req: PatternSearchRequest):
    return pattern_service.search(
        query_language=req.query_language,
        search_languages=req.search_languages,
        query_tokens=req.tokens,
        limit=req.limit,
    )
