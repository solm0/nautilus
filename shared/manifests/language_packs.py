from __future__ import annotations

HF_PACK_REPO_ID = "solm0/nautilus-releases"
HF_PACK_REPO_TYPE = "dataset"


def build_pack_download_url(lang: str, version: str, filename: str) -> str:
    return (
        f"https://huggingface.co/datasets/{HF_PACK_REPO_ID}/resolve/main/"
        f"language-packs/{lang}/{version}/{filename}"
    )


def build_pack(
    lang: str,
    version: str,
    corpus: list[dict[str, str]],
):
    lemma_filename = f"{lang}-v{version}-lemma.zip"
    ngram_filename = f"{lang}-v{version}-ngram.zip"

    return {
        "lang": lang,
        "version": version,
        "tag": f"v{version}",
        "lemma_filename": lemma_filename,
        "ngram_filename": ngram_filename,
        "lemma_download_url": build_pack_download_url(lang, version, lemma_filename),
        "ngram_download_url": build_pack_download_url(lang, version, ngram_filename),
        "corpus": corpus,
    }


# Runtime manifests are the source of truth for language-specific NLP
# dependencies. Pack versions may change frequently, but runtime requirements
# only change when we add a language or swap its underlying toolchain.
RUNTIME_MANIFESTS = {
    "de": {
        "lang": "de",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["stanza"],
        "resource_packages": [],
        "models": [
            {
                "id": "stanza-de",
                "provider": "stanza",
                "lang": "de",
                "resource_id": "stanza-model-de",
            }
        ],
    },
    "en": {
        "lang": "en",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["stanza"],
        "resource_packages": [],
        "models": [
            {
                "id": "stanza-en",
                "provider": "stanza",
                "lang": "en",
                "resource_id": "stanza-model-en",
            }
        ],
    },
    "ja": {
        "lang": "ja",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["stanza"],
        "resource_packages": [],
        "models": [
            {
                "id": "stanza-ja",
                "provider": "stanza",
                "lang": "ja",
                "resource_id": "stanza-model-ja",
            }
        ],
    },
    "ko": {
        "lang": "ko",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["stanza", "kiwipiepy", "kiwipiepy_model"],
        "resource_packages": ["kiwipiepy", "kiwipiepy_model"],
        "models": [
            {
                "id": "stanza-ko",
                "provider": "stanza",
                "lang": "ko",
                "resource_id": "stanza-model-ko",
            }
        ],
    },
    "mk": {
        "lang": "mk",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["classla", "obeliks", "udtools", "reldi_tokeniser"],
        "resource_packages": ["obeliks", "udtools", "reldi_tokeniser"],
        "models": [
            {
                "id": "classla-mk",
                "provider": "classla",
                "lang": "mk",
                "resource_id": "classla-model-mk",
            }
        ],
    },
    "ru": {
        "lang": "ru",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["stanza"],
        "resource_packages": [],
        "models": [
            {
                "id": "stanza-ru",
                "provider": "stanza",
                "lang": "ru",
                "resource_id": "stanza-model-ru",
            }
        ],
    },
    "sq": {
        "lang": "sq",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["stanza"],
        "resource_packages": [],
        "models": [
            {
                "id": "stanza-sq",
                "provider": "stanza",
                "lang": "sq",
                "resource_id": "stanza-model-sq",
            }
        ],
    },
    "sr": {
        "lang": "sr",
        "runtime_version": 1,
        "shared_dependencies": ["torch"],
        "language_packages": ["classla", "obeliks", "udtools", "reldi_tokeniser"],
        "resource_packages": ["obeliks", "udtools", "reldi_tokeniser"],
        "models": [
            {
                "id": "classla-sr",
                "provider": "classla",
                "lang": "sr",
                "resource_id": "classla-model-sr",
            }
        ],
    },
}


PACK_RELEASES = {
    "ru": [
        build_pack(
            "ru",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "rus_wikipedia_2021_300K, rus-ru_web-public_2019_1M"},
            ],
        ),
        build_pack(
            "ru",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "rus_wikipedia_2021_300K, rus-ru_web-public_2019_1M"},
            ],
        ),
    ],
    "de": [
        build_pack(
            "de",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "deu_wikipedia_2021_300K, deu-de_web_2021_1M"},
            ],
        ),
        build_pack(
            "de",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "deu_wikipedia_2021_300K, deu-de_web_2021_1M"},
            ],
        ),
    ],
    "en": [
        build_pack(
            "en",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "eng-simple_wikipedia_2021_300K, eng-uk_web-public_2018_1M"},
            ],
        ),
        build_pack(
            "en",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "eng-simple_wikipedia_2021_300K, eng-uk_web-public_2018_1M"},
            ],
        ),
    ],
    "sr": [
        build_pack(
            "sr",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "srp_wikipedia_2021_300K, srp-rs_web_2016_1M"},
            ],
        ),
        build_pack(
            "sr",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "srp_wikipedia_2021_300K, srp-rs_web_2016_1M"},
            ],
        ),
    ],
    "mk": [
        build_pack(
            "mk",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "mkd_wikipedia_2021_300K, mkd-mk_web_2015_1M"},
            ],
        ),
        build_pack(
            "mk",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "mkd_wikipedia_2021_300K, mkd-mk_web_2015_1M"},
            ],
        ),
    ],
    "sq": [
        build_pack(
            "sq",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "sqi_wikipedia_2021_300K, sqi_news_2020_1M"},
            ],
        ),
        build_pack(
            "sq",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "sqi_wikipedia_2021_300K, sqi_news_2020_1M"},
            ],
        ),
    ],
    "ko": [
        build_pack(
            "ko",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "kor_wikipedia_2021_300K, kor-kr_web_2020_1M"},
            ],
        ),
        build_pack(
            "ko",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "kor_wikipedia_2021_300K, kor-kr_web_2020_1M"},
            ],
        ),
    ],
    "ja": [
        build_pack(
            "ja",
            "1.1.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "jpn_wikipedia_2021_300K, jpn-jp_web_2020_1M"},
            ],
        ),
        build_pack(
            "ja",
            "1.0.0",
            [
                {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
                {"Corpora used": "jpn_wikipedia_2021_300K, jpn-jp_web_2020_1M"},
            ],
        ),
    ],
}


PACKS = [
    pack
    for lang in sorted(PACK_RELEASES.keys())
    for pack in PACK_RELEASES[lang]
]


def get_pack_map() -> dict[str, dict]:
    return {lang: releases[0] for lang, releases in PACK_RELEASES.items() if releases}


def get_latest_pack(lang: str) -> dict | None:
    releases = PACK_RELEASES.get(lang, [])
    return releases[0] if releases else None


def get_runtime_manifest(lang: str) -> dict:
    try:
        return RUNTIME_MANIFESTS[lang]
    except KeyError as exc:
        raise KeyError(f"Unknown runtime manifest for language: {lang}") from exc


def get_model_provider(lang: str) -> str:
    manifest = get_runtime_manifest(lang)
    models = manifest.get("models") or []

    if not models:
        raise ValueError(f"Language {lang} does not define any models")

    provider = models[0].get("provider")

    if not provider:
        raise ValueError(f"Language {lang} has a model without provider")

    return provider


def get_shared_dependency_ids(lang: str) -> list[str]:
    manifest = get_runtime_manifest(lang)
    return list(manifest.get("shared_dependencies") or [])


def get_language_package_ids(lang: str) -> list[str]:
    manifest = get_runtime_manifest(lang)
    return list(manifest.get("language_packages") or [])


def get_resource_package_ids(lang: str) -> list[str]:
    manifest = get_runtime_manifest(lang)
    return list(manifest.get("resource_packages") or [])


def get_model_resource_ids(lang: str) -> list[str]:
    manifest = get_runtime_manifest(lang)
    models = manifest.get("models") or []
    resource_ids = []

    for model in models:
        resource_id = model.get("resource_id")
        if resource_id:
            resource_ids.append(resource_id)

    return resource_ids


def get_runtime_resource_plan(lang: str) -> dict[str, list[str]]:
    return {
        "shared_dependencies": get_shared_dependency_ids(lang),
        "language_packages": get_language_package_ids(lang),
        "resource_packages": get_resource_package_ids(lang),
        "model_resources": get_model_resource_ids(lang),
    }


def list_languages() -> list[str]:
    ordered = []
    seen = set()

    for lang in RUNTIME_MANIFESTS:
        if lang in seen:
            continue
        seen.add(lang)
        ordered.append(lang)

    for lang in PACK_RELEASES:
        if lang in seen:
            continue
        seen.add(lang)
        ordered.append(lang)

    return ordered


def list_runtime_manifests() -> list[dict]:
    return [RUNTIME_MANIFESTS[lang] for lang in list_languages() if lang in RUNTIME_MANIFESTS]
