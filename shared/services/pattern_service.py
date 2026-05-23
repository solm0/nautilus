from __future__ import annotations

from typing import Any
from heapq import nlargest

from services import lemma_service


FUNCTION_POS = {
    "ADP",
    "AUX",
    "CCONJ",
    "SCONJ",
    "DET",
    "PART",
    "PRON",
}

LEXICALLY_SENSITIVE_POS = {
    "ADP",
    "AUX",
    "CCONJ",
    "DET",
    "PART",
    "PRON",
    "SCONJ",
}

POS_GROUPS = {
    "ADP": "ADP",
    "AUX": "AUX",
    "CCONJ": "CCONJ/SCONJ",
    "SCONJ": "CCONJ/SCONJ",
    "DET": "DET/PRON",
    "PRON": "DET/PRON",
    "PART": "PART",
    "VERB": "VERB",
    "NOUN": "NOUN",
    "PROPN": "NOUN",
    "ADJ": "ADJ",
    "ADV": "ADV",
    "NUM": "NUM",
    "INTJ": "INTJ",
}

DEP_GROUPS = {
    "acl": "clause",
    "advcl": "clause",
    "advmod": "advmod",
    "amod": "mod",
    "aux": "aux",
    "case": "case",
    "cc": "cc",
    "ccomp": "clause",
    "compound": "mod",
    "conj": "conj",
    "cop": "cop",
    "csubj": "subj",
    "det": "det",
    "discourse": "disc",
    "expl": "subj",
    "fixed": "fixed",
    "flat": "flat",
    "goeswith": "flat",
    "iobj": "obj",
    "mark": "mark",
    "nmod": "mod",
    "nsubj": "subj",
    "nummod": "mod",
    "obj": "obj",
    "obl": "obl",
    "pcomp": "clause",
    "parataxis": "clause",
    "root": "root",
    "vocative": "disc",
    "xcomp": "clause",
}

DEP_NORMALIZATION = {
    "ac": "clause",
    "acomp": "root",
    "ad": "advmod",
    "adv": "advmod",
    "agent": "obl",
    "ag": "mod",
    "attr": "root",
    "avz": "compound",
    "cc": "cc",
    "cd": "cc",
    "cj": "conj",
    "cm": "mark",
    "cp": "mark",
    "da": "iobj",
    "dobj": "obj",
    "ep": "expl",
    "expl:pv": "expl",
    "expl:subj": "expl",
    "gmod": "mod",
    "mnr": "advmod",
    "mo": "obl",
    "ng": "mod",
    "nk": "mod",
    "nmod:poss": "det",
    "oa": "obj",
    "oc": "clause",
    "og": "obj",
    "op": "obl",
    "oprd": "root",
    "par": "parataxis",
    "pc": "case",
    "pcomp": "clause",
    "pnc": "mod",
    "pobj": "obj",
    "poss": "det",
    "prep": "case",
    "prt": "compound",
    "punct": "punct",
    "rc": "acl",
    "re": "expl",
    "rs": "nsubj",
    "sb": "nsubj",
    "svp": "compound",
}

SUBJECT_DEPS = {
    "csubj",
    "expl",
    "nsubj",
}

SUBORDINATE_DEPS = {
    "acl",
    "advcl",
    "ccomp",
    "csubj",
    "mark",
    "pcomp",
    "xcomp",
}

BOUNDARY_CORE_DEPS = {
    "root",
    "conj",
    "parataxis",
    "ccomp",
    "xcomp",
    "advcl",
    "acl",
    "pcomp",
}

SUPPORTED_LANGUAGES = {
    "de",
    "en",
    "fr",
    "es",
    "ja",
    "ko",
    "mk",
    "ru",
    "sr",
    "zh",
}

ANCHOR_LEMMAS = {
    "de": {
        "als",
        "auch",
        "bevor",
        "bei",
        "bleiben",
        "damit",
        "doch",
        "für",
        "gab",
        "gibt",
        "ging",
        "hier",
        "im",
        "für",
        "gegen",
        "in",
        "ins",
        "mit",
        "nach",
        "nur",
        "ob",
        "ohne",
        "oder",
        "seit",
        "um",
        "unter",
        "von",
        "vor",
        "während",
        "weil",
        "wenn",
        "wie",
        "wo",
        "zu",
        "zum",
        "zur",
    },
    "en": {
        "about",
        "after",
        "against",
        "around",
        "as",
        "because",
        "before",
        "between",
        "by",
        "for",
        "from",
        "if",
        "in",
        "inside",
        "into",
        "like",
        "near",
        "of",
        "on",
        "out",
        "over",
        "since",
        "there",
        "through",
        "though",
        "to",
        "under",
        "until",
        "when",
        "while",
        "with",
        "without",
    },
    "ru": {
        "без",
        "будто",
        "будто",
        "в",
        "во",
        "вместо",
        "для",
        "если",
        "за",
        "здесь",
        "и",
        "из",
        "или",
        "как",
        "когда",
        "между",
        "над",
        "на",
        "нет",
        "не",
        "но",
        "о",
        "об",
        "от",
        "перед",
        "по",
        "под",
        "пока",
        "потому",
        "при",
        "с",
        "со",
        "у",
        "хотя",
        "через",
    },
    "sr": {
        "ako",
        "bez",
        "dok",
        "gde",
        "i",
        "ili",
        "iz",
        "između",
        "kao",
        "kada",
        "kod",
        "na",
        "nad",
        "nakon",
        "nema",
        "nego",
        "o",
        "od",
        "oko",
        "pod",
        "posle",
        "pre",
        "preko",
        "sa",
        "u",
        "uz",
        "zato",
        "za",
    },
}

COPULA_LEMMAS = {
    "de": {
        "sein",
        "bin",
        "bist",
        "ist",
        "seid",
        "sind",
        "war",
        "waren",
        "warst",
        "wird",
        "werden",
    },
    "en": {
        "am",
        "are",
        "be",
        "been",
        "being",
        "is",
        "was",
        "were",
    },
    "ru": {
        "быть",
        "был",
        "была",
        "были",
        "было",
        "будет",
    },
    "sr": {
        "biti",
        "bio",
        "bila",
        "bili",
        "bilo",
        "sam",
        "si",
        "smo",
        "ste",
        "su",
    },
}

ANCHOR_SURFACES = {
    "en": {
        "there's": "there",
        "there’re": "there",
    },
    "ru": {
        "нет": "нет",
    },
}

CROSS_ANCHOR_MAP = {
    "de": {
        "aber": "@coord_contrast",
        "als": "@temp_subord",
        "bevor": "@temp_subord",
        "oder": "@coord_alt",
        "und": "@coord_add",
        "wenn": "@temp_subord",
        "während": "@temp_subord",
        "weil": "@cause_subord",
        "mit": "@comitative_adp",
        "ohne": "@without_adp",
        "in": "@loc_in",
        "im": "@loc_in",
        "ins": "@loc_in",
        "bei": "@loc_near",
        "zu": "@goal_to",
        "zum": "@goal_to",
        "zur": "@goal_to",
    },
    "en": {
        "and": "@coord_add",
        "but": "@coord_contrast",
        "or": "@coord_alt",
        "before": "@temp_subord",
        "when": "@temp_subord",
        "while": "@temp_subord",
        "because": "@cause_subord",
        "if": "@cond_subord",
        "with": "@comitative_adp",
        "without": "@without_adp",
        "in": "@loc_in",
        "inside": "@loc_in",
        "into": "@loc_in",
        "by": "@loc_near",
        "to": "@goal_to",
    },
    "ru": {
        "и": "@coord_add",
        "но": "@coord_contrast",
        "или": "@coord_alt",
        "когда": "@temp_subord",
        "пока": "@temp_subord",
        "потому": "@cause_subord",
        "если": "@cond_subord",
        "с": "@comitative_adp",
        "со": "@comitative_adp",
        "без": "@without_adp",
        "в": "@loc_in",
        "во": "@loc_in",
        "у": "@loc_near",
        "к": "@goal_to",
        "нет": "@neg_exist",
    },
    "sr": {
        "i": "@coord_add",
        "nego": "@coord_contrast",
        "ili": "@coord_alt",
        "dok": "@temp_subord",
        "kada": "@temp_subord",
        "zato": "@cause_subord",
        "ako": "@cond_subord",
        "sa": "@comitative_adp",
        "bez": "@without_adp",
        "u": "@loc_in",
        "kod": "@loc_near",
        "za": "@goal_to",
        "nema": "@neg_exist",
    },
}

AUX_SEMANTIC_MAP = {
    "de": {
        "haben": "@aux_have",
        "hat": "@aux_have",
        "habe": "@aux_have",
        "hast": "@aux_have",
        "hatte": "@aux_have",
        "sein": "@aux_be",
        "bin": "@aux_be",
        "bist": "@aux_be",
        "ist": "@aux_be",
        "seid": "@aux_be",
        "sind": "@aux_be",
        "war": "@aux_be",
        "waren": "@aux_be",
        "werden": "@aux_modal",
        "wird": "@aux_modal",
        "kann": "@aux_modal",
        "können": "@aux_modal",
        "muss": "@aux_modal",
        "müssen": "@aux_modal",
        "soll": "@aux_modal",
        "sollen": "@aux_modal",
        "will": "@aux_modal",
        "wollen": "@aux_modal",
    },
    "en": {
        "am": "@aux_be",
        "are": "@aux_be",
        "be": "@aux_be",
        "been": "@aux_be",
        "being": "@aux_be",
        "can": "@aux_modal",
        "could": "@aux_modal",
        "did": "@aux_support",
        "do": "@aux_support",
        "does": "@aux_support",
        "had": "@aux_have",
        "has": "@aux_have",
        "have": "@aux_have",
        "is": "@aux_be",
        "may": "@aux_modal",
        "might": "@aux_modal",
        "must": "@aux_modal",
        "shall": "@aux_modal",
        "should": "@aux_modal",
        "was": "@aux_be",
        "were": "@aux_be",
        "will": "@aux_modal",
        "would": "@aux_modal",
    },
    "ru": {
        "быть": "@aux_be",
        "был": "@aux_be",
        "была": "@aux_be",
        "были": "@aux_be",
        "было": "@aux_be",
        "будет": "@aux_modal",
        "мочь": "@aux_modal",
        "может": "@aux_modal",
        "мог": "@aux_modal",
    },
    "sr": {
        "biti": "@aux_be",
        "bio": "@aux_be",
        "bila": "@aux_be",
        "bili": "@aux_be",
        "bilo": "@aux_be",
        "sam": "@aux_be",
        "si": "@aux_be",
        "smo": "@aux_be",
        "ste": "@aux_be",
        "su": "@aux_be",
        "moći": "@aux_modal",
        "može": "@aux_modal",
        "mogu": "@aux_modal",
    },
}


def _build_cross_anchor_forms():
    result: dict[str, dict[str, set[str]]] = {}

    for language, mapping in CROSS_ANCHOR_MAP.items():
        bucket: dict[str, set[str]] = {}

        for form, anchor in mapping.items():
            bucket.setdefault(anchor, set()).add(form)

        result[language] = bucket

    return result


CROSS_ANCHOR_FORMS = _build_cross_anchor_forms()


def is_supported_language(language: str) -> bool:
    return language in SUPPORTED_LANGUAGES


def _token_to_group(token: dict[str, Any]) -> str:
    pos = token.get("pos")

    if pos in POS_GROUPS:
        return POS_GROUPS[pos]

    if pos:
        return pos

    surface = str(token.get("surface") or "").strip()
    if not surface:
        return "?"

    if surface.isdigit():
        return "M"

    return "X"


def _is_punct_token(token: dict[str, Any]) -> bool:
    return token.get("pos") == "PUNCT"


def _normalized_anchor_text(language: str, token: dict[str, Any]) -> str:
    lemma = str(token.get("lemma") or "").strip().lower()
    surface = str(token.get("surface") or "").strip().lower()

    if surface in ANCHOR_SURFACES.get(language, {}):
        return ANCHOR_SURFACES[language][surface]

    if lemma:
        return lemma

    return surface


def _base_dep(token: dict[str, Any]) -> str | None:
    raw_dep = token.get("dep")

    if not raw_dep:
        return None

    dep = str(raw_dep).strip().lower()
    if not dep:
        return None

    normalized = DEP_NORMALIZATION.get(dep, dep)
    base = normalized.split(":", 1)[0]
    pos = token.get("pos")

    if base == "nk":
        if pos in {"DET", "PRON"}:
            return "det"
        if pos == "ADP":
            return "case"
        return "mod"

    if base == "mo":
        if pos == "ADV":
            return "advmod"
        if pos == "ADP":
            return "case"
        return "obl"

    if base == "pd":
        if pos in {"ADJ", "NOUN", "PROPN", "PRON", "ADV"}:
            return "root"
        return "cop"

    if base == "oc":
        if pos in {"VERB", "AUX"}:
            return "clause"
        return "obj"

    return base


def _anchor_symbol(language: str, token: dict[str, Any], cross_language: bool = False) -> str | None:
    normalized = _normalized_anchor_text(language, token)

    if cross_language:
        cross_anchor = CROSS_ANCHOR_MAP.get(language, {}).get(normalized)
        if cross_anchor is not None:
            return cross_anchor

    if normalized in ANCHOR_LEMMAS.get(language, set()):
        return f"@{normalized}"

    return None


def _nearest_content_pos(tokens: list[dict[str, Any]], index: int, step: int) -> str | None:
    pointer = index + step

    while 0 <= pointer < len(tokens):
        pos = tokens[pointer].get("pos")

        if pos and pos != "PUNCT":
            return pos

        pointer += step

    return None


def _copula_symbol(language: str, tokens: list[dict[str, Any]], index: int) -> str | None:
    token = tokens[index]
    normalized = _normalized_anchor_text(language, token)
    dep = _base_dep(token)

    if normalized not in COPULA_LEMMAS.get(language, set()):
        return None

    if dep == "aux":
        return None

    right_pos = _nearest_content_pos(tokens, index, 1)

    if dep == "cop":
        if right_pos in {"ADJ", "ADV"}:
            return "@cop_pred"

        if right_pos in {"NOUN", "PROPN", "PRON", "NUM"}:
            return "@cop_nom"

        if right_pos == "ADP":
            return "@cop_pp"

        return "@cop"

    if right_pos in {"ADJ", "ADV"}:
        return "@cop_pred"

    if right_pos in {"NOUN", "PROPN", "PRON", "NUM"}:
        return "@cop_nom"

    if right_pos == "ADP":
        return "@cop_pp"

    return "@cop"


def _token_to_fine_symbol(language: str, tokens: list[dict[str, Any]], index: int, cross_language: bool = False) -> str:
    token = tokens[index]
    pos = token.get("pos")
    copula = _copula_symbol(language, tokens, index)

    if copula is not None:
        return copula

    anchor = _anchor_symbol(language, token, cross_language=cross_language)

    if anchor is not None:
        return anchor

    if pos in {"ADP", "SCONJ", "CCONJ"}:
        anchor = _anchor_symbol(language, token, cross_language=True)
        if anchor is not None:
            return anchor
        return pos

    if pos in {"AUX", "DET", "PRON", "PART"}:
        normalized = _normalized_anchor_text(language, token)
        if pos == "AUX":
            aux_symbol = AUX_SEMANTIC_MAP.get(language, {}).get(normalized)
            if aux_symbol is not None:
                return aux_symbol
        return POS_GROUPS.get(pos, pos)

    return _token_to_group(token)


def _token_to_dep_group(token: dict[str, Any]) -> str:
    dep = _base_dep(token)

    if dep is None:
        return "?"

    return DEP_GROUPS.get(dep, dep)


def _token_to_pos_symbol(token: dict[str, Any]) -> str:
    pos = token.get("pos")
    return pos if pos else "?"


def _token_to_lemma_symbol(language: str, token: dict[str, Any]) -> str:
    pos = token.get("pos")

    if pos not in LEXICALLY_SENSITIVE_POS:
        return "_"

    normalized = _normalized_anchor_text(language, token)
    return normalized if normalized else "_"


def _build_sketch(language: str, tokens: list[dict[str, Any]], start: int, end: int, cross_language: bool = False):
    window = tokens[start:end + 1]
    pos = [_token_to_pos_symbol(token) for token in window]
    fine = [
        _token_to_fine_symbol(language, window, index, cross_language=cross_language)
        for index in range(len(window))
    ]
    coarse = [_token_to_group(token) for token in window]
    deps = [_token_to_dep_group(token) for token in window]
    lemmas = [_token_to_lemma_symbol(language, token) for token in window]
    anchors = [
        symbol
        for symbol in fine
        if symbol.startswith("@")
    ]

    return {
        "fine": fine,
        "pos": pos,
        "coarse": coarse,
        "deps": deps,
        "lemmas": lemmas,
        "anchors": anchors,
    }


def _score_symbol_sequence(query: list[str], candidate: list[str]) -> float:
    if not query or not candidate:
        return 0.0

    max_len = max(len(query), len(candidate))
    min_len = min(len(query), len(candidate))

    same_position = sum(1 for q, c in zip(query, candidate) if q == c)
    prefix_bonus = 1 if query[0] == candidate[0] else 0
    suffix_bonus = 1 if query[-1] == candidate[-1] else 0
    length_penalty = abs(len(query) - len(candidate)) / max_len

    return (
        (same_position / max_len) * 0.75
        + (min_len / max_len) * 0.15
        + ((prefix_bonus + suffix_bonus) / 2) * 0.10
        - length_penalty * 0.15
    )


def _strip_edge_punctuation(tokens: list[dict[str, Any]], start: int, end: int) -> tuple[int, int] | None:
    next_start = start
    next_end = end

    while next_start <= next_end and _is_punct_token(tokens[next_start]):
        next_start += 1

    while next_end >= next_start and _is_punct_token(tokens[next_end]):
        next_end -= 1

    if next_start > next_end:
        return None

    return next_start, next_end


def _non_punct_tokens(tokens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [token for token in tokens if not _is_punct_token(token)]


def _score_anchor_overlap(query_anchors: list[str], candidate_anchors: list[str]) -> float:
    if not query_anchors:
        return 0.0

    query_set = set(query_anchors)
    candidate_set = set(candidate_anchors)

    return len(query_set & candidate_set) / len(query_set)


def _shared_anchor_count(query_anchors: list[str], candidate_anchors: list[str]) -> int:
    if not query_anchors or not candidate_anchors:
        return 0

    return len(set(query_anchors) & set(candidate_anchors))


def _structure_profile(tokens: list[dict[str, Any]]) -> dict[str, int]:
    subject_count = 0
    subordinate_count = 0
    clause_head_count = 0
    boundary_root_like_count = 0
    first_dep = _base_dep(tokens[0]) if tokens else None
    last_dep = _base_dep(tokens[-1]) if tokens else None

    for token in tokens:
        dep = _base_dep(token)
        pos = token.get("pos")

        if dep in SUBJECT_DEPS:
            subject_count += 1

        if dep in SUBORDINATE_DEPS:
            subordinate_count += 1

        if pos in {"VERB", "AUX"} and dep in {"root", "conj", "parataxis", "ccomp", "xcomp", "advcl", "acl"}:
            clause_head_count += 1

        if dep in BOUNDARY_CORE_DEPS:
            boundary_root_like_count += 1

    return {
        "subject_count": subject_count,
        "subordinate_count": subordinate_count,
        "clause_head_count": clause_head_count,
        "boundary_root_like_count": boundary_root_like_count,
        "starts_with_root": int(first_dep == "root"),
        "ends_with_core_clause": int(last_dep in BOUNDARY_CORE_DEPS) if last_dep is not None else 0,
    }


def _score_structure_profile(query_profile: dict[str, int], candidate_profile: dict[str, int]) -> float:
    checks = (
        query_profile["subject_count"] == candidate_profile["subject_count"],
        query_profile["subordinate_count"] == candidate_profile["subordinate_count"],
        query_profile["clause_head_count"] == candidate_profile["clause_head_count"],
        query_profile["boundary_root_like_count"] == candidate_profile["boundary_root_like_count"],
        query_profile["starts_with_root"] == candidate_profile["starts_with_root"],
        query_profile["ends_with_core_clause"] == candidate_profile["ends_with_core_clause"],
    )

    return sum(1 for passed in checks if passed) / len(checks)


def _score_boundary_compatibility(
    query_sketch: dict[str, list[str]],
    candidate_sketch: dict[str, list[str]],
) -> float:
    checks = (
        query_sketch["coarse"][0] == candidate_sketch["coarse"][0],
        query_sketch["deps"][0] == candidate_sketch["deps"][0],
        query_sketch["coarse"][-1] == candidate_sketch["coarse"][-1],
        query_sketch["deps"][-1] == candidate_sketch["deps"][-1],
    )

    return sum(1 for passed in checks if passed) / len(checks)


def _lemma_bonus(
    lemma_score: float,
    dep_score: float,
    structure_score: float,
    boundary_score: float,
) -> float:
    # Lemma is only a late-stage tie-breaker once the window is already
    # structurally convincing.
    if dep_score < 0.55 or structure_score < 0.80 or boundary_score < 0.75:
        return 0.0

    return lemma_score


def _score_window(
    query_language: str,
    candidate_language: str,
    query_tokens: list[dict[str, Any]],
    candidate_tokens: list[dict[str, Any]],
    start: int,
    end: int,
):
    cross_language = query_language != candidate_language
    trimmed = _strip_edge_punctuation(candidate_tokens, start, end)
    if trimmed is None:
        return None

    actual_start, actual_end = trimmed
    query_core_tokens = _non_punct_tokens(query_tokens)
    candidate_window_tokens = candidate_tokens[actual_start:actual_end + 1]
    candidate_core_tokens = _non_punct_tokens(candidate_window_tokens)

    if len(query_core_tokens) < 2 or len(candidate_core_tokens) < 2:
        return None

    query_sketch = _build_sketch(
        query_language,
        query_core_tokens,
        0,
        len(query_core_tokens) - 1,
        cross_language=cross_language,
    )
    candidate_sketch = _build_sketch(
        candidate_language,
        candidate_core_tokens,
        0,
        len(candidate_core_tokens) - 1,
        cross_language=cross_language,
    )

    fine_score = _score_symbol_sequence(query_sketch["fine"], candidate_sketch["fine"])
    pos_score = _score_symbol_sequence(query_sketch["pos"], candidate_sketch["pos"])
    coarse_score = _score_symbol_sequence(query_sketch["coarse"], candidate_sketch["coarse"])
    dep_score = _score_symbol_sequence(query_sketch["deps"], candidate_sketch["deps"])
    lemma_score = _score_symbol_sequence(query_sketch["lemmas"], candidate_sketch["lemmas"])
    anchor_score = _score_anchor_overlap(query_sketch["anchors"], candidate_sketch["anchors"])
    shared_anchor_count = _shared_anchor_count(query_sketch["anchors"], candidate_sketch["anchors"])
    query_profile = _structure_profile(query_core_tokens)
    candidate_profile = _structure_profile(candidate_core_tokens)
    structure_score = _score_structure_profile(query_profile, candidate_profile)
    boundary_score = _score_boundary_compatibility(query_sketch, candidate_sketch)
    lemma_bonus = _lemma_bonus(
        lemma_score=lemma_score,
        dep_score=dep_score,
        structure_score=structure_score,
        boundary_score=boundary_score,
    )

    query_groups = query_sketch["coarse"]
    candidate_groups = candidate_sketch["coarse"]

    shared_multiset = sum(
        min(query_groups.count(symbol), candidate_groups.count(symbol))
        for symbol in set(query_groups)
    )
    multiset_score = shared_multiset / max(len(query_groups), len(candidate_groups), 1)

    return {
        "start": actual_start,
        "end": actual_end,
        "score": round(
            fine_score * 0.27
            + pos_score * 0.10
            + coarse_score * 0.08
            + dep_score * 0.22
            + multiset_score * 0.06
            + anchor_score * 0.12
            + structure_score * 0.14
            + boundary_score * 0.10
            + lemma_bonus * 0.01
            + min(shared_anchor_count, 2) * 0.04,
            4,
        ),
        "fine": candidate_sketch["fine"],
        "pos": candidate_sketch["pos"],
        "coarse": candidate_sketch["coarse"],
        "deps": candidate_sketch["deps"],
        "lemmas": candidate_sketch["lemmas"],
        "anchors": candidate_sketch["anchors"],
        "anchor_score": round(anchor_score, 4),
        "pos_score": round(pos_score, 4),
        "dep_score": round(dep_score, 4),
        "lemma_score": round(lemma_score, 4),
        "lemma_bonus": round(lemma_bonus, 4),
        "structure_score": round(structure_score, 4),
        "boundary_score": round(boundary_score, 4),
        "shared_anchor_count": shared_anchor_count,
    }


def _best_window(
    query_language: str,
    candidate_language: str,
    query_tokens: list[dict[str, Any]],
    candidate_tokens: list[dict[str, Any]],
):
    query_len = len(query_tokens)
    if query_len < 2 or len(candidate_tokens) < 2:
        return None

    min_len = max(2, query_len - 2)
    max_len = min(len(candidate_tokens), query_len + 2)
    best: dict[str, Any] | None = None

    for window_len in range(min_len, max_len + 1):
        for start in range(0, len(candidate_tokens) - window_len + 1):
            end = start + window_len - 1
            scored = _score_window(
                query_language,
                candidate_language,
                query_tokens,
                candidate_tokens,
                start,
                end,
            )

            if scored is None:
                continue

            if best is None or scored["score"] > best["score"]:
                best = scored

    return best


def _is_reasonable_candidate(best_window: dict[str, Any] | None):
    if best_window is None:
        return False

    if best_window["boundary_score"] < 0.25:
        return False

    if best_window["structure_score"] < 0.40:
        return False

    if best_window["shared_anchor_count"] > 0:
        return best_window["score"] >= 0.38 and best_window["dep_score"] >= 0.35

    return (
        best_window["score"] >= 0.60
        and best_window["dep_score"] >= 0.45
        and best_window["boundary_score"] >= 0.50
    )


def _collect_same_language_candidate_line_ids(language: str, query_tokens: list[dict[str, Any]]) -> list[int]:
    seen: set[int] = set()
    result: list[int] = []
    language_data = lemma_service._load_language(language)
    pack_db = language_data["pack_db"]

    if pack_db is None:
        return []

    for token in query_tokens:
        lemma = token.get("lemma")
        pos = token.get("pos")

        if not lemma or not pos:
            continue

        for line_id in lemma_service.get_line_ids(f"{lemma}_{pos}", language):
            if line_id in seen:
                continue

            seen.add(line_id)
            result.append(line_id)

    for token in query_tokens:
        anchor = _anchor_symbol(language, token, cross_language=True)
        if anchor is None:
            continue

        forms: set[str] = set()

        if anchor.startswith("@cop"):
            forms.update(COPULA_LEMMAS.get(language, set()))
        else:
            forms.update(CROSS_ANCHOR_FORMS.get(language, {}).get(anchor, set()))
            raw_anchor = anchor[1:]
            if raw_anchor:
                forms.add(raw_anchor)

        if not forms:
            continue

        for line_id in pack_db.find_line_ids_by_token_forms(sorted(forms), limit=600):
            if line_id in seen:
                continue

            seen.add(line_id)
            result.append(line_id)

    return result[:1200]


def _collect_cross_language_candidate_line_ids(
    target_language: str,
    query_language: str,
    query_tokens: list[dict[str, Any]],
) -> list[int]:
    language_data = lemma_service._load_language(target_language)
    pack_db = language_data["pack_db"]

    if pack_db is None:
        return []

    query_sketch = _build_sketch(
        query_language,
        query_tokens,
        0,
        len(query_tokens) - 1,
        cross_language=True,
    )
    generic_anchors = query_sketch["anchors"]

    if not generic_anchors:
        return []

    forms: set[str] = set()

    for anchor in generic_anchors:
        if anchor.startswith("@cop"):
            forms.update(COPULA_LEMMAS.get(target_language, set()))
            continue

        forms.update(CROSS_ANCHOR_FORMS.get(target_language, {}).get(anchor, set()))

    if not forms:
        return []

    return pack_db.find_line_ids_by_token_forms(sorted(forms), limit=1600)


def _search_one_language(
    target_language: str,
    query_language: str,
    query_tokens: list[dict[str, Any]],
    limit: int = 20,
):
    if not is_supported_language(target_language):
        return {
            "status": "unsupported_language",
            "message": f"Pattern search is not available for {target_language} yet.",
            "query": None,
            "results": [],
        }

    normalized_query_tokens = [
        token
        for token in query_tokens
        if (token.get("surface") or "").strip()
    ]

    if len(normalized_query_tokens) < 2:
        return {
            "status": "insufficient_selection",
            "message": "Select at least two tokens to search for a pattern.",
            "query": None,
            "results": [],
        }

    if query_language == target_language:
        line_ids = _collect_same_language_candidate_line_ids(target_language, normalized_query_tokens)
    else:
        line_ids = _collect_cross_language_candidate_line_ids(target_language, query_language, normalized_query_tokens)

    if not line_ids:
        return {
            "status": "ok",
            "message": "No candidate lines were found from this selection yet.",
            "query": {
                "tokens": normalized_query_tokens,
                "sketch": _build_sketch(query_language, normalized_query_tokens, 0, len(normalized_query_tokens) - 1),
            },
            "results": [],
        }

    language_data = lemma_service._load_language(target_language)
    pack_db = language_data["pack_db"]
    if pack_db is None:
        return {
            "status": "missing_pack",
            "message": "This language pack is not available locally.",
            "query": None,
            "results": [],
        }

    query_sketch = _build_sketch(query_language, normalized_query_tokens, 0, len(normalized_query_tokens) - 1)
    results = []
    query_has_anchors = len(query_sketch["anchors"]) > 0

    for line in pack_db.get_lines(line_ids):
        candidate_tokens = line.get("tokens", [])
        best_window = _best_window(query_language, target_language, normalized_query_tokens, candidate_tokens)

        if not _is_reasonable_candidate(best_window):
            continue

        if query_has_anchors and best_window["shared_anchor_count"] == 0:
            continue

        results.append({
            "language": target_language,
            "line_id": line.get("line_id"),
            "score": best_window["score"],
            "tokens": candidate_tokens,
            "match_start": best_window["start"],
            "match_end": best_window["end"],
            "match_sketch": {
                "fine": best_window["fine"],
                "pos": best_window["pos"],
                "coarse": best_window["coarse"],
                "deps": best_window["deps"],
                "lemmas": best_window["lemmas"],
                "anchors": best_window["anchors"],
            },
            "anchor_score": best_window["anchor_score"],
            "pos_score": best_window["pos_score"],
            "dep_score": best_window["dep_score"],
            "lemma_score": best_window["lemma_score"],
            "structure_score": best_window["structure_score"],
            "boundary_score": best_window["boundary_score"],
            "shared_anchor_count": best_window["shared_anchor_count"],
        })

    results.sort(
        key=lambda item: (
            item["score"],
            item["boundary_score"],
            item["structure_score"],
            item["dep_score"],
            item["shared_anchor_count"],
        ),
        reverse=True,
    )

    return {
        "status": "ok",
        "message": None,
        "query": {
            "tokens": normalized_query_tokens,
            "sketch": query_sketch,
        },
        "results": results[:limit],
    }


def search(
    query_language: str,
    search_languages: list[str],
    query_tokens: list[dict[str, Any]],
    limit: int = 20,
):
    unique_languages: list[str] = []
    seen_languages = set()

    for language in search_languages:
        if language in seen_languages:
            continue
        seen_languages.add(language)
        unique_languages.append(language)

    if not unique_languages:
        unique_languages = [query_language]

    query_payload = None
    merged_results = []
    messages = []

    for target_language in unique_languages:
        response = _search_one_language(
            target_language=target_language,
            query_language=query_language,
            query_tokens=query_tokens,
            limit=limit,
        )

        if query_payload is None and response.get("query") is not None:
            query_payload = response["query"]

        if response.get("message") and response.get("status") != "ok":
            messages.append(response["message"])

        merged_results.extend(response.get("results", []))

    merged_results = nlargest(
        limit,
        merged_results,
        key=lambda item: (
            item["score"],
            item["boundary_score"],
            item["structure_score"],
            item["dep_score"],
            item["shared_anchor_count"],
        ),
    )

    return {
        "status": "ok" if query_payload is not None else "insufficient_selection",
        "message": messages[0] if messages and query_payload is None else None,
        "query": query_payload,
        "results": merged_results,
    }
