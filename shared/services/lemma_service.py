import random
import os
from pathlib import Path
from typing import Dict

from language_config.registry import get_latest_version_path
from language_config.sqlite_pack import LanguagePackDB, find_pack_db

try:
    from runtime_paths import get_static_data_root as _get_static_data_root
except ModuleNotFoundError:
    _get_static_data_root = None


def get_static_data_root() -> Path:
    override = os.getenv("LEMA_DATA_STATIC_ROOT") or os.getenv("NAUTILUS_DATA_STATIC_ROOT")
    if override:
        return Path(override).resolve()

    candidates: list[Path] = []

    if _get_static_data_root is not None:
        candidates.append(_get_static_data_root())

    repo_root = Path(__file__).resolve().parents[2]
    candidates.extend([
        repo_root / "central" / "data" / "static",
        repo_root / "backend" / "data" / "static",
    ])

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


BASE_DIR = get_static_data_root()

# lang별 캐시
_registry: Dict[str, dict] = {}


def _load_language(lang: str):
    if lang in _registry:
        return _registry[lang]

    lang_dir = BASE_DIR / lang
    pack_db = None

    if lang_dir.exists():
        try:
            version_path = get_latest_version_path(lang_dir)
        except ValueError:
            # Empty language directories are placeholders for uninstalled packs.
            version_path = None

        if version_path is not None:
            db_path = find_pack_db(version_path)
            pack_db = LanguagePackDB(db_path) if db_path else None

    data = {
        "pack_db": pack_db,
    }

    _registry[lang] = data
    return data


def invalidate_language(lang: str):
    data = _registry.pop(lang, None)

    if not data:
        return

    pack_db = data.get("pack_db")

    if hasattr(pack_db, "close"):
        pack_db.close()


# ---- helpers ----

def has_key(key: str, lang: str):
    data = _load_language(lang)
    pack_db = data["pack_db"]
    return pack_db.has_lemma_key(key) if pack_db else False


def get_line_ids(key: str, lang: str):
    data = _load_language(lang)
    pack_db = data["pack_db"]
    return pack_db.get_line_ids(key) if pack_db else []


def get_furigana(key: str, lang: str):
    data = _load_language(lang)
    pack_db = data["pack_db"]
    return pack_db.get_furigana(key) if pack_db else None


def find_match_indices(tokens, lemma, pos):
    indices = []
    for i, t in enumerate(tokens):
        if t.get("lemma") == lemma and t.get("pos") == pos:
            indices.append(i)
            continue

        for morph in t.get("morphs") or []:
            if morph.get("lemma") == lemma and morph.get("pos") == pos:
                indices.append(i)
                break

    return indices


KWIC_EXAMPLE_LIMIT = 12


def sample_kwic(line_ids, lemma, pos, lang: str, max_k=KWIC_EXAMPLE_LIMIT):
    data = _load_language(lang)
    pack_db = data["pack_db"]

    if pack_db is None:
        return []

    # Only a small candidate pool is needed to return ``max_k`` examples.
    # Sampling IDs first avoids loading and decoding every matching corpus line.
    candidate_limit = max(max_k * 10, max_k)
    candidate_ids = line_ids

    if len(line_ids) > candidate_limit:
        candidate_ids = random.sample(line_ids, candidate_limit)

    short, mid, long = [], [], []

    for line in pack_db.get_lines(candidate_ids):
        tokens = line["tokens"]
        length = len(tokens)

        if length <= 8:
            short.append(line)
        elif length <= 15:
            mid.append(line)
        else:
            long.append(line)

    def pick(bucket, k):
        if len(bucket) <= k:
            return bucket
        return random.sample(bucket, k)

    result = []
    per_bucket = max_k // 3

    result.extend(pick(short, per_bucket))
    result.extend(pick(mid, per_bucket))
    result.extend(pick(long, per_bucket))

    if len(result) < max_k:
        remaining = [l for l in (short + mid + long) if l not in result]
        if remaining:
            result.extend(
                random.sample(remaining, min(len(remaining), max_k - len(result)))
            )

    kwic = []

    for line in result[:max_k]:
        tokens = line["tokens"]
        indices = find_match_indices(tokens, lemma, pos)

        if not indices:
            continue

        kwic.append({
            "line_id": line["line_id"],
            "tokens": tokens,
            "match_indices": indices
        })

    return kwic
