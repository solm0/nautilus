import json

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

from services.nlp_service import analyze_text
from services.prediction_service import predict_next, search_prefix, tokenize
from language_config.sr import cyr_to_lat
import unicodedata

router = APIRouter(prefix="/api")


class Block(BaseModel):
    text: str


class AnalyzeRequest(BaseModel):
    blocks: List[Block]
    language: str


def normalize_sr(text: str) -> str:
    text = unicodedata.normalize("NFC", text)
    text = text
    return cyr_to_lat(text)


def parse_context_tokens(raw: str | None):
    if not raw:
        return []

    try:
        tokens = json.loads(raw)
    except json.JSONDecodeError:
        return []

    if not isinstance(tokens, list):
        return []

    return [
        token
        for token in tokens
        if isinstance(token, str) and token
    ]


def tokens_from_request(text: str | None, language: str, context: str | None):
    context_tokens = parse_context_tokens(context)

    if context_tokens:
        return context_tokens

    if text is None:
        return []

    return tokenize(text, language)

@router.get("/predict")
def predict(language: str, text: str | None = None, context: str | None = None):
    tokens = tokens_from_request(text, language, context)

    return {
        "input": text or "",
        "tokens": tokens,
        "predictions": predict_next(tokens, language)
    }


@router.get("/search")
def search(q: str, language: str, text: str | None = None, context: str | None = None):
    context_tokens = tokens_from_request(text, language, context)

    return {
        "query": q,
        "tokens": context_tokens,
        "predictions": search_prefix(q, language, context_tokens=context_tokens)
    }


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    out_blocks = []

    for block in req.blocks:
        text = block.text.strip()

        if not text:
            out_blocks.append({
                "text": block.text,
                "tokens": []
            })
            continue

        # sr이면 변환
        if req.language == "sr":
            text = normalize_sr(text)

        out_blocks.append({
            "text": block.text,
            "tokens": analyze_text(text, req.language) or []
        })

    return {"blocks": out_blocks}
