import os
import requests
import zipfile
import tempfile
from pathlib import Path
from dotenv import load_dotenv
import shutil
from language_config.sqlite_pack import (
    LEMMA_TABLES,
    NGRAM_TABLES,
    find_lemma_db,
    find_ngram_db,
    has_required_tables,
)

load_dotenv()

DATA_DIR = Path("./data/static")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")

progress_map = {}


def get_install_state(lang: str, version: str):
    path = DATA_DIR / lang / version
    lemma_db_path = find_lemma_db(path)
    ngram_db_path = find_ngram_db(path)

    lemma_installed = (
        lemma_db_path is not None
        and has_required_tables(lemma_db_path, LEMMA_TABLES)
    )
    ngram_installed = (
        ngram_db_path is not None
        and has_required_tables(ngram_db_path, NGRAM_TABLES)
    )

    return {
        "lemma_installed": lemma_installed,
        "ngram_installed": ngram_installed,
        "installed": lemma_installed,
    }


def install_pack(
    lang: str,
    version: str,
    filename: str | None,
    asset_kind: str,
    task_id: str,
):
    os.makedirs(DATA_DIR, exist_ok=True)

    if asset_kind not in {"lemma", "ngram"}:
        raise Exception(f"invalid asset_kind: {asset_kind}")

    if not filename:
        raise Exception("filename is required for split pack install")

    if asset_kind == "ngram" and not get_install_state(lang, version)["lemma_installed"]:
        raise Exception("lemma pack must be installed first")

    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/tags/{lang}-v{version}"

    headers_api = {
        "Authorization": f"token {GITHUB_TOKEN}"
    }

    headers_download = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/octet-stream"
    }

    progress_map[task_id] = {"progress": 0.0, "status": "downloading"}

    try:
        # 1. release 조회
        res = requests.get(api_url, headers=headers_api)

        if res.status_code != 200:
            raise Exception(f"GitHub API error: {res.status_code} {res.text}")

        release = res.json()

        asset = next((a for a in release["assets"] if a["name"] == filename), None)

        if not asset:
            raise Exception(f"asset not found: {filename}")

        # 2. download
        download_url = f"https://api.github.com/repos/{GITHUB_REPO}/releases/assets/{asset['id']}"

        r = requests.get(download_url, headers=headers_download, stream=True)

        if r.status_code != 200:
            raise Exception(f"download failed: {r.status_code}")

        total = int(r.headers.get("content-length", 0))
        downloaded = 0

        tmp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")

        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                tmp_zip.write(chunk)
                downloaded += len(chunk)

                if total:
                    progress_map[task_id] = {
                        "progress": downloaded / total,
                        "status": "downloading"
                    }
                else:
                    current_progress = progress_map[task_id]["progress"]
                    progress_map[task_id] = {
                        "progress": min(0.9, current_progress + 0.01),
                        "status": "downloading",
                    }

        tmp_zip.close()

        progress_map[task_id] = {
            "progress": max(progress_map[task_id]["progress"], 0.92),
            "status": "extracting",
        }

        # 3. unzip
        extract_path = DATA_DIR / lang / version
        os.makedirs(extract_path, exist_ok=True)

        with zipfile.ZipFile(tmp_zip.name, "r") as zip_ref:
            for member in zip_ref.infolist():
                name = member.filename

                if name.startswith("__MACOSX/") or "/__MACOSX/" in name:
                    continue

                if member.is_dir():
                    continue

                parts = name.split("/", 1)
                new_name = parts[1] if len(parts) == 2 else parts[0]

                if not new_name or new_name.strip() == "":
                    continue

                if ".." in new_name:
                    continue

                target_path = extract_path / new_name
                target_path.parent.mkdir(parents=True, exist_ok=True)
                if target_path.exists():
                    target_path.unlink()

                with zip_ref.open(member, "r") as src, open(target_path, "wb") as dst:
                    shutil.copyfileobj(src, dst)

        progress_map[task_id] = {
            "progress": 1.0,
            "status": "done"
        }

        # tmp 파일 삭제
        os.remove(tmp_zip.name)

        if not verify_install(lang, version, asset_kind):
            raise Exception("install corrupted")

        return str(extract_path)

    except Exception as e:
        progress_map[task_id] = {
            "progress": 0,
            "status": "error",
            "error": str(e)
        }
        raise e


def uninstall_pack(lang: str, version: str):
    path = DATA_DIR / lang / version

    if path.exists():
        shutil.rmtree(path, ignore_errors=True)

    # stanza 캐시 삭제
    remove_stanza(lang)


def remove_stanza(lang: str):
    """
    ~/.stanza_resources/{lang} 삭제
    """
    path = Path.home() / "stanza_resources" / lang

    if path.exists():
        shutil.rmtree(path, ignore_errors=True)

def is_installed(lang: str, version: str):
    return get_install_state(lang, version)["installed"]


def verify_install(lang: str, version: str, asset_kind: str = "lemma"):
    path = DATA_DIR / lang / version

    if asset_kind == "ngram":
        lemma_db_path = find_lemma_db(path)
        ngram_db_path = find_ngram_db(path)
        if lemma_db_path is None or ngram_db_path is None:
            return False
        return (
            has_required_tables(lemma_db_path, LEMMA_TABLES)
            and has_required_tables(ngram_db_path, NGRAM_TABLES)
        )

    lemma_db_path = find_lemma_db(path)
    if lemma_db_path is None:
        return False
    return has_required_tables(lemma_db_path, LEMMA_TABLES)
