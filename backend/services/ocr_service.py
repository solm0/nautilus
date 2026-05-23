import numpy as np
from language_config import get_config
from fastapi import HTTPException

def _to_py(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, list):
        return [_to_py(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _to_py(v) for k, v in obj.items()}
    return obj


def run_ocr(img, lang: str):
    cfg = get_config(lang)

    normalize = cfg["normalize"]
    get_reader = cfg.get("get_ocr")

    try:
        reader = get_reader() if callable(get_reader) else None
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"OCR backend init failed for language: {lang}"
        ) from exc

    if reader is None:
        raise HTTPException(
            status_code=400,
            detail=f"OCR not supported for language: {lang}"
        )

    result = reader.readtext(img)

    blocks = []
    texts = []

    for bbox, text, conf in result:
        text = normalize(str(text))

        blocks.append({
            "text": text,
            "confidence": float(conf)
        })

        if text:
            texts.append(text)

    return blocks, texts


def postprocess(texts, lang: str):
    normalize = get_config(lang)["normalize"]

    return "\n".join(
        normalize(t.strip())
        for t in texts
        if t and t.strip()
    )
