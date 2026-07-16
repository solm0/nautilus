import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from huggingface_hub import HfApi, hf_hub_url


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from central.packs import PACKS


BACKEND_ENV_PATH = ROOT_DIR / "backend" / ".env"
RELEASES_DIR = ROOT_DIR / "releases"
DEFAULT_HF_REPO_ID = "solm0/nautilus-releases"
DEFAULT_HF_REPO_TYPE = "dataset"


def load_env():
    load_dotenv(BACKEND_ENV_PATH)

    token = os.getenv("HF_TOKEN")
    repo_id = os.getenv("HF_REPO_ID") or DEFAULT_HF_REPO_ID
    repo_type = os.getenv("HF_REPO_TYPE") or DEFAULT_HF_REPO_TYPE

    if not token:
        raise RuntimeError(f"HF_TOKEN is missing in {BACKEND_ENV_PATH}")

    return token, repo_id, repo_type


def get_pack_map():
    return {pack["lang"]: pack for pack in PACKS}


def resolve_release_artifacts(lang: str, version: str):
    release_dir = RELEASES_DIR / lang / f"{lang}-v{version}"
    lemma_zip = release_dir / f"{lang}-v{version}-lemma.zip"
    ngram_zip = release_dir / f"{lang}-v{version}-ngram.zip"

    missing = [path.name for path in (lemma_zip, ngram_zip) if not path.exists()]
    if missing:
        raise FileNotFoundError(
            f"Missing release artifacts for {lang} v{version}: {', '.join(missing)}"
        )

    return {
        "lemma": lemma_zip,
        "ngram": ngram_zip,
    }


def upload_asset(api: HfApi, repo_id: str, repo_type: str, lang: str, version: str, asset_path: Path):
    path_in_repo = f"language-packs/{lang}/{version}/{asset_path.name}"
    api.upload_file(
        path_or_fileobj=str(asset_path),
        path_in_repo=path_in_repo,
        repo_id=repo_id,
        repo_type=repo_type,
        commit_message=f"Upload {lang} {version} {asset_path.name}",
    )
    return hf_hub_url(
        repo_id=repo_id,
        repo_type=repo_type,
        revision="main",
        filename=path_in_repo,
    )


def publish_language(api: HfApi, repo_id: str, repo_type: str, lang: str, version: str):
    assets = resolve_release_artifacts(lang, version)
    urls = {}

    for asset_kind, asset_path in assets.items():
        print(f"Uploading {asset_path.name} -> language-packs/{lang}/{version}/")
        urls[asset_kind] = upload_asset(api, repo_id, repo_type, lang, version, asset_path)

    print(f"Published {lang} v{version}")
    for asset_kind, url in urls.items():
        print(f"  {asset_kind}: {url}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload split lemma/ngram zip assets to Hugging Face.",
    )
    parser.add_argument(
        "--lang",
        action="append",
        dest="langs",
        help="Language code to publish. Repeat for multiple languages. Defaults to all PACKS languages.",
    )
    parser.add_argument(
        "--version",
        help="Override version for all selected languages. Defaults to central/packs.py version per language.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    token, repo_id, repo_type = load_env()
    pack_map = get_pack_map()
    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type=repo_type, private=False, exist_ok=True)

    langs = args.langs or list(pack_map.keys())

    for lang in langs:
        pack = pack_map.get(lang)

        if pack is None:
            raise KeyError(f"Unknown language: {lang}")

        version = args.version or pack["version"]
        publish_language(api, repo_id, repo_type, lang, version)


if __name__ == "__main__":
    main()
