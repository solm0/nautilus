import argparse
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from huggingface_hub import HfApi, hf_hub_url

from preprocess.publish_releases import call_with_retry, ensure_repo_exists, load_env


RELEASES_DIR = ROOT_DIR / "releases"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Upload lemma zip assets to Hugging Face.",
    )
    parser.add_argument(
        "--lang",
        action="append",
        dest="langs",
        required=True,
        help="Language code to upload. Repeat for multiple languages.",
    )
    parser.add_argument(
        "--version",
        required=True,
        help="Pack version to upload, for example 1.1.0",
    )
    return parser.parse_args()


def resolve_asset(lang: str, version: str) -> Path:
    asset_path = RELEASES_DIR / lang / f"{lang}-v{version}" / f"{lang}-v{version}-lemma.zip"
    if not asset_path.exists():
        raise FileNotFoundError(f"Missing lemma asset: {asset_path}")
    return asset_path


def upload_asset(api: HfApi, repo_id: str, repo_type: str, lang: str, version: str, asset_path: Path):
    path_in_repo = f"language-packs/{lang}/{version}/{asset_path.name}"
    call_with_retry(
        f"upload_file:{asset_path.name}",
        api.upload_file,
        path_or_fileobj=str(asset_path),
        path_in_repo=path_in_repo,
        repo_id=repo_id,
        repo_type=repo_type,
        commit_message=f"Upload {lang} {version} lemma zip without dep",
    )
    return hf_hub_url(
        repo_id=repo_id,
        repo_type=repo_type,
        revision="main",
        filename=path_in_repo,
    )


def main():
    args = parse_args()
    token, repo_id, repo_type = load_env()
    api = HfApi(token=token)
    ensure_repo_exists(api, repo_id=repo_id, repo_type=repo_type)

    for lang in args.langs:
        asset_path = resolve_asset(lang, args.version)
        print(f"Uploading {asset_path.name} -> language-packs/{lang}/{args.version}/")
        url = upload_asset(api, repo_id, repo_type, lang, args.version, asset_path)
        print(f"Published {lang} v{args.version}")
        print(f"  lemma: {url}")


if __name__ == "__main__":
    main()
