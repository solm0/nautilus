HF_PACK_REPO_ID = "solm0/nautilus-releases"
HF_PACK_REPO_TYPE = "dataset"


def build_pack_download_url(lang: str, version: str, filename: str):
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


PACKS = [
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
]
