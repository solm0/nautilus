from language_config.registry import load_language


def tokenize(text: str, language: str):
    cfg = load_language(language)
    return cfg["tokenize"](text)


def normalize_text(text: str, language: str):
    cfg = load_language(language)
    normalize = cfg.get("normalize")

    if callable(normalize):
        return normalize(text)

    return text

def normalize_predictions(preds, limit=10):
    if not preds:
        return []

    # dict -> list
    if isinstance(preds, dict):
        total = sum(preds.values()) or 1

        return [
            (w, f / total)
            for w, f in sorted(
                preds.items(),
                key=lambda x: x[1],
                reverse=True
            )[:limit]
        ]

    # 이미 list면 그대로
    if isinstance(preds, list):
        return preds[:limit]

    return []


def _normalize_score_map(score_map: dict[str, float]):
    if not score_map:
        return {}

    total = sum(score_map.values()) or 1.0
    return {
        word: score / total
        for word, score in score_map.items()
    }


def _context_score_map(tokens, language: str):
    cfg = load_language(language)
    pack_db = cfg.get("pack_db")

    if pack_db is None:
        return {}

    if tokens and tokens[-1] == "<s>":
        return dict(normalize_predictions(pack_db.get_unigrams(limit=10), limit=10))

    if len(tokens) >= 2:
        tri = pack_db.get_trigram((tokens[-2], tokens[-1]), limit=10)
        if tri:
            return dict(normalize_predictions(tri, limit=10))

    if len(tokens) >= 1:
        bi = pack_db.get_bigram((tokens[-1],), limit=10)
        if bi:
            return dict(normalize_predictions(bi, limit=10))

    return dict(normalize_predictions(pack_db.get_unigrams(limit=10), limit=10))


def predict_next(tokens, language: str):
    return list(_context_score_map(tokens, language).items())


def search_prefix(q: str, language: str, context_tokens=None, limit: int = 10):
    cfg = load_language(language)
    pack_db = cfg.get("pack_db")

    if pack_db is None:
        return []

    q = normalize_text(q, language).strip()

    if len(q) < 3:
        return []

    anchor = q[:5]
    results = pack_db.get_prefix_matches(anchor, limit=50)

    if anchor != q:
        results = [
            (word, freq)
            for word, freq in results
            if word.startswith(q)
        ]

    if not results:
        return []

    total = sum(freq for _, freq in results) or 1
    prefix_scores = {
        word: freq / total
        for word, freq in results
    }
    context_scores = _context_score_map(context_tokens or [], language)
    candidate_context_scores = _normalize_score_map(
        {
            word: context_scores[word]
            for word in prefix_scores
            if word in context_scores
        }
    )

    if context_tokens and candidate_context_scores:
        alpha = 0.35
        ranked = [
            (
                word,
                alpha * prefix_scores[word] + (1 - alpha) * candidate_context_scores.get(word, 0.0),
            )
            for word, _ in results
        ]
    elif context_tokens:
        alpha = 0.7
        ranked = [
            (
                word,
                alpha * prefix_scores[word] + (1 - alpha) * context_scores.get(word, 0.0),
            )
            for word, _ in results
        ]
    else:
        ranked = list(prefix_scores.items())

    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked[:limit]
