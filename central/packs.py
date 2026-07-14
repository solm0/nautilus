VERSION = "1.1.0"


def build_pack(lang: str, corpus: list[dict[str, str]]):
    return {
        "lang": lang,
        "version": VERSION,
        "tag": f"v{VERSION}",
        "lemma_filename": f"{lang}-v{VERSION}-lemma.zip",
        "ngram_filename": f"{lang}-v{VERSION}-ngram.zip",
        "corpus": corpus,
    }


PACKS = [
    build_pack(
        "ru",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "rus_wikipedia_2021_300K, rus-ru_web-public_2019_1M"},
        ],
    ),
    build_pack(
        "de",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "deu_wikipedia_2021_300K, deu-de_web_2021_1M"},
        ],
    ),
    build_pack(
        "en",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "eng-simple_wikipedia_2021_300K, eng-uk_web-public_2018_1M"},
        ],
    ),
    build_pack(
        "sr",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "srp_wikipedia_2021_300K, srp-rs_web_2016_1M"},
        ],
    ),
    build_pack(
        "mk",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "mkd_wikipedia_2021_300K, mkd-mk_web_2015_1M"},
        ],
    ),
    build_pack(
        "sq",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "sqi_wikipedia_2021_300K, sqi_news_2020_1M"},
        ],
    ),
    build_pack(
        "ko",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "kor_wikipedia_2021_300K, kor-kr_web_2020_1M"},
        ],
    ),
    build_pack(
        "ja",
        [
            {"Data source": "Leipzig Corpora Collection, University of Leipzig"},
            {"Corpora used": "jpn_wikipedia_2021_300K, jpn-jp_web_2020_1M"},
        ],
    ),
]
