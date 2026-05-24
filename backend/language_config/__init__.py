from typing import Dict
from .registry import load_language

# ---- facade 유지 ----

def get_config(lang: str):
    return load_language(lang)


def get_nlp(lang: str):
    return load_language(lang)["get_nlp"]()
