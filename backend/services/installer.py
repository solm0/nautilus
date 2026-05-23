import os
import requests
import zipfile
import tempfile
from pathlib import Path
from dotenv import load_dotenv
import shutil
from language_config.sqlite_pack import find_pack_db, has_required_tables

load_dotenv()

DATA_DIR = Path("./data/static")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")

progress_map = {}


def install_pack(lang: str, version: str, filename: str | None, task_id: str):
    os.makedirs(DATA_DIR, exist_ok=True)

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

        asset = None

        if filename:
            asset = next((a for a in release["assets"] if a["name"] == filename), None)

        if asset is None:
            asset = next(
                (
                    a for a in release["assets"]
                    if a["name"].lower().endswith(".zip")
                ),
                None,
            )

        if not asset:
            raise Exception("asset not found")

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

        tmp_zip.close()

        # 3. unzip
        extract_path = DATA_DIR / lang / version

        if extract_path.exists():
            shutil.rmtree(extract_path, ignore_errors=True)

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

                member.filename = new_name
                zip_ref.extract(member, extract_path)

        progress_map[task_id] = {
            "progress": 1.0,
            "status": "done"
        }

        # tmp 파일 삭제
        os.remove(tmp_zip.name)

        if not verify_install(lang, version):
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
    return verify_install(lang, version)


def verify_install(lang: str, version: str):
    path = DATA_DIR / lang / version
    db_path = find_pack_db(path)

    if db_path is None:
        return False

    return has_required_tables(db_path)
