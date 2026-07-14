import argparse
import os
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from central.packs import PACKS


BACKEND_ENV_PATH = ROOT_DIR / "backend" / ".env"
RELEASES_DIR = ROOT_DIR / "releases"


def load_env():
    load_dotenv(BACKEND_ENV_PATH)

    token = os.getenv("GITHUB_TOKEN")
    repo = os.getenv("GITHUB_REPO")

    if not token:
        raise RuntimeError(f"GITHUB_TOKEN is missing in {BACKEND_ENV_PATH}")

    if not repo:
        raise RuntimeError(f"GITHUB_REPO is missing in {BACKEND_ENV_PATH}")

    return token, repo


def github_headers(token: str, *, json_accept: bool = True):
    headers = {
        "Authorization": f"Bearer {token}",
    }

    if json_accept:
        headers["Accept"] = "application/vnd.github+json"

    return headers


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

    return release_dir, {
        "lemma": lemma_zip,
        "ngram": ngram_zip,
    }


def get_release_by_tag(repo: str, token: str, tag_name: str):
    url = f"https://api.github.com/repos/{repo}/releases/tags/{tag_name}"
    response = requests.get(url, headers=github_headers(token), timeout=30)

    if response.status_code == 404:
        return None

    response.raise_for_status()
    return response.json()


def create_release(repo: str, token: str, tag_name: str, version: str):
    url = f"https://api.github.com/repos/{repo}/releases"
    payload = {
        "tag_name": tag_name,
        "name": tag_name,
        "draft": False,
        "prerelease": False,
        "generate_release_notes": False,
        "body": f"Split language-pack assets for v{version}.",
    }

    response = requests.post(
        url,
        headers=github_headers(token),
        json=payload,
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def delete_asset(repo: str, token: str, asset_id: int):
    url = f"https://api.github.com/repos/{repo}/releases/assets/{asset_id}"
    response = requests.delete(url, headers=github_headers(token), timeout=30)
    response.raise_for_status()


def upload_asset(upload_url: str, token: str, asset_path: Path):
    upload_endpoint = upload_url.split("{", 1)[0]
    params = {"name": asset_path.name}

    with open(asset_path, "rb") as f:
        response = requests.post(
            upload_endpoint,
            params=params,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/zip",
            },
            data=f,
            timeout=300,
        )

    response.raise_for_status()
    return response.json()


def ensure_release(repo: str, token: str, lang: str, version: str):
    tag_name = f"{lang}-v{version}"
    release = get_release_by_tag(repo, token, tag_name)

    if release is not None:
        return release

    print(f"Creating release {tag_name}")
    return create_release(repo, token, tag_name, version)


def replace_assets(repo: str, token: str, release: dict, assets: dict[str, Path]):
    existing_assets = {asset["name"]: asset for asset in release.get("assets", [])}

    for asset_path in assets.values():
        existing = existing_assets.get(asset_path.name)
        if existing is not None:
            print(f"Deleting existing asset {asset_path.name}")
            delete_asset(repo, token, existing["id"])

        print(f"Uploading {asset_path.name}")
        upload_asset(release["upload_url"], token, asset_path)


def publish_language(repo: str, token: str, lang: str, version: str):
    _, assets = resolve_release_artifacts(lang, version)
    release = ensure_release(repo, token, lang, version)
    replace_assets(repo, token, release, assets)
    print(f"Published {lang} v{version}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload split lemma/ngram zip assets to GitHub Releases.",
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
    token, repo = load_env()
    pack_map = get_pack_map()

    langs = args.langs or list(pack_map.keys())

    for lang in langs:
        pack = pack_map.get(lang)

        if pack is None:
            raise KeyError(f"Unknown language: {lang}")

        version = args.version or pack["version"]
        publish_language(repo, token, lang, version)


if __name__ == "__main__":
    main()
