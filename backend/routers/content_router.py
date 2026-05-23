import json

from fastapi import APIRouter, File, UploadFile, Form
from pydantic import ConfigDict
from pydantic import BaseModel
from typing import List

from services.nlp_service import align_tokens
from services.ocr_service import run_ocr, postprocess
from services.ipa_service import attach_token_ipa, describe_token_articulation
from services.prediction_service import predict_next, search_prefix, tokenize
from language_config import get_nlp
from language_config.sr import cyr_to_lat
import unicodedata

router = APIRouter(prefix="/api")


class Block(BaseModel):
    text: str

class AnalyzeRequest(BaseModel):
    blocks: List[Block]
    language: str


class TokenInput(BaseModel):
    model_config = ConfigDict(extra="allow")

    surface: str
    lemma: str | None = None
    pos: str | None = None
    dep: str | None = None
    ipa: str | None = None


class IpaEnrichBlock(BaseModel):
    model_config = ConfigDict(extra="allow")

    text: str
    timestamp_ms: int | None = None
    tokens: List[TokenInput] = []


class IpaEnrichRequest(BaseModel):
    blocks: List[IpaEnrichBlock]
    language: str


class ArticulationRequest(BaseModel):
    tokens: List[TokenInput]
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


@router.post("/ocr")
async def ocr_image(
    file: UploadFile = File(...),
    language: str = Form(...)
):
    import cv2
    import numpy as np

    img_bytes = await file.read()

    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if img is None:
        return {"text": "", "blocks": []}

    blocks, texts = run_ocr(img, language)
    full_text = postprocess(texts, language)

    return {
        "text": full_text,
        "blocks": blocks
    }


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    nlp = get_nlp(req.language)

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

        doc = nlp(text)

        tokens_all = []
        for sent in doc.sentences:
            tokens_all.extend(align_tokens(sent))

        out_blocks.append({
            "text": block.text,
            "tokens": tokens_all or []
        })

    return {"blocks": out_blocks}


@router.post("/ipa")
def enrich_ipa(req: IpaEnrichRequest):
    blocks = [block.model_dump() for block in req.blocks]
    return {
        "blocks": attach_token_ipa(blocks, req.language)
    }


@router.post("/articulation")
def articulation(req: ArticulationRequest):
    items = []

    for token_index, token in enumerate(req.tokens):
        segments = describe_token_articulation(
            surface=token.surface,
            ipa=token.ipa,
        )

        for segment_index, segment in enumerate(segments):
            items.append({
                **segment,
                "token_index": token_index,
                "segment_index": segment_index,
            })

    return {
        "items": items
    }
