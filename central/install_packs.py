import os
import shutil
import zipfile
from pathlib import Path

import requests
from packaging.version import Version

from language_config.sqlite_pack import (
    LEMMA_TABLES,
    NGRAM_TABLES,
    find_lemma_db,
    find_ngram_db,
    has_required_tables,
)
from packs import PACKS

# 1. GitHub Releases 조회
# 2. 언어별 최신 버전 선택
# 3. 현재 설치 버전 확인
# 4. 최신이면 skip
# 5. 낮은 버전이면 제거
# 6. zip 다운로드
# 7. ./data/static/{lang}/{version}/ 에 압축 해제

GITHUB_REPO = "solm0/nautilus"

CENTRAL_DIR = Path(__file__).resolve().parent
BASE_DIR = CENTRAL_DIR / "data" / "static"
TMP_DIR = CENTRAL_DIR / "tmp_packs"

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")


def github_headers():
    headers = {
        "Accept": "application/vnd.github+json",
    }

    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    return headers


def get_latest_release_asset(lang: str):
    """
    Fetch latest release metadata for a language pack.
    Example tag:
        ru-v1.1.0
    """

    releases_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases"

    res = requests.get(releases_url, headers=github_headers(), timeout=30)
    res.raise_for_status()

    releases = res.json()

    prefix = f"{lang}-v"
    matched = []

    for release in releases:
        tag_name = release.get("tag_name", "")

        if not tag_name.startswith(prefix):
            continue

        version_str = tag_name.replace(prefix, "")

        try:
            version = Version(version_str)
        except Exception:
            continue

        assets = release.get("assets", [])
        lemma_name = f"{lang}-v{version}-lemma.zip"
        ngram_name = f"{lang}-v{version}-ngram.zip"
        assets_by_name = {asset["name"]: asset for asset in assets}

        if lemma_name not in assets_by_name or ngram_name not in assets_by_name:
            continue

        matched.append((version, assets_by_name))

    if not matched:
        return None

    matched.sort(key=lambda x: x[0], reverse=True)

    latest_version, assets_by_name = matched[0]
    lemma_name = f"{lang}-v{latest_version}-lemma.zip"
    ngram_name = f"{lang}-v{latest_version}-ngram.zip"

    return {
        "version": str(latest_version),
        "assets": {
            "lemma": {
                "download_url": assets_by_name[lemma_name]["browser_download_url"],
                "filename": lemma_name,
            },
            "ngram": {
                "download_url": assets_by_name[ngram_name]["browser_download_url"],
                "filename": ngram_name,
            },
        },
    }


def is_version_fully_installed(lang: str, version: str) -> bool:
    version_dir = BASE_DIR / lang / version
    lemma_db_path = find_lemma_db(version_dir)
    ngram_db_path = find_ngram_db(version_dir)

    if lemma_db_path is None or ngram_db_path is None:
        return False

    return (
        has_required_tables(lemma_db_path, LEMMA_TABLES)
        and has_required_tables(ngram_db_path, NGRAM_TABLES)
    )


def get_installed_versions(lang: str):
    lang_dir = BASE_DIR / lang

    if not lang_dir.exists():
        return []

    versions = []

    for item in lang_dir.iterdir():
        if item.is_dir():
            try:
                versions.append(Version(item.name))
            except Exception:
                pass

    return sorted(versions, reverse=True)


def remove_old_versions(lang: str, keep_version: str):
    lang_dir = BASE_DIR / lang

    if not lang_dir.exists():
        return

    for item in lang_dir.iterdir():
        if not item.is_dir():
            continue

        if item.name != keep_version:
            print(f"Removing old version: {item}")
            shutil.rmtree(item, ignore_errors=True)


def download_file(url: str, target: Path):
    with requests.get(url, headers=github_headers(), stream=True, timeout=120) as r:
        r.raise_for_status()

        with open(target, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)


def install_pack(lang: str, version: str, zip_path: Path):
    target_dir = BASE_DIR / lang / version

    target_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        for member in zip_ref.infolist():
            if member.is_dir():
                continue

            target_path = target_dir / member.filename
            target_path.parent.mkdir(parents=True, exist_ok=True)
            if target_path.exists():
                target_path.unlink()

            with zip_ref.open(member, "r") as src, open(target_path, "wb") as dst:
                shutil.copyfileobj(src, dst)

    print(f"Installed {lang} v{version}")


def process_language(lang: str):
    print(f"\n=== Processing {lang} ===")

    latest = get_latest_release_asset(lang)

    if not latest:
        print(f"No release found for {lang}")
        return

    latest_version = Version(latest["version"])

    installed_versions = get_installed_versions(lang)

    if installed_versions:
        installed_latest = installed_versions[0]

        if installed_latest > latest_version:
            print(f"{lang} already up to date ({installed_latest})")
            return

        if (
            installed_latest == latest_version
            and is_version_fully_installed(lang, str(latest_version))
        ):
            print(f"{lang} already up to date ({installed_latest})")
            return

    remove_old_versions(lang, str(latest_version))

    target_dir = BASE_DIR / lang / str(latest_version)

    if target_dir.exists():
        print(f"Refreshing install directory: {target_dir}")
        shutil.rmtree(target_dir, ignore_errors=True)

    TMP_DIR.mkdir(parents=True, exist_ok=True)

    for asset_kind, asset in latest["assets"].items():
        zip_path = TMP_DIR / asset["filename"]

        print(f"Downloading {asset_kind}: {asset['download_url']}")
        download_file(asset["download_url"], zip_path)
        install_pack(lang, str(latest_version), zip_path)
        zip_path.unlink(missing_ok=True)

    if not is_version_fully_installed(lang, str(latest_version)):
        raise RuntimeError(
            f"{lang} {latest_version} install is incomplete after downloading split assets"
        )


def main():
    for pack in PACKS:
        lang = pack["lang"]

        try:
            process_language(lang)
        except Exception as e:
            print(f"Failed processing {lang}: {e}")


if __name__ == "__main__":
    main()
