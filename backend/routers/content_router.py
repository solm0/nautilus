from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

from services.nlp_service import analyze_text
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
