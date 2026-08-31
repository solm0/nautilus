from __future__ import annotations

import importlib.metadata
import importlib.util
import json
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from runtime_paths import get_runtime_package_root, is_packaged_backend
from shared.manifests import get_runtime_package_spec


MARKER_NAME = ".lema-overlay.json"


def _get_package_root(package_name: str) -> Path | None:
    spec = importlib.util.find_spec(package_name)

    if spec is None:
        return None

    if spec.submodule_search_locations:
        return Path(next(iter(spec.submodule_search_locations))).resolve()

    origin = spec.origin
    if not origin:
        return None

    return Path(origin).resolve().parent


def _get_package_version(package_name: str) -> str | None:
    try:
        return importlib.metadata.version(package_name)
    except Exception:
        return None


def _marker_path(dest_root: Path, package_name: str) -> Path:
    return dest_root / package_name / MARKER_NAME


def _read_marker(dest_root: Path, package_name: str) -> dict | None:
    path = _marker_path(dest_root, package_name)
    if not path.exists():
        return None

    try:
        with open(path, encoding="utf-8") as infile:
            return json.load(infile)
    except Exception:
        return None


def _write_marker(dest_root: Path, package_name: str, source_root: Path) -> None:
    marker = {
        "package": package_name,
        "version": _get_package_version(package_name),
        "source_root": str(source_root),
    }
    path = _marker_path(dest_root, package_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as outfile:
        json.dump(marker, outfile, ensure_ascii=True, indent=2)
        outfile.write("\n")


def _write_download_marker(dest_root: Path, package_name: str, wheel_url: str) -> None:
    marker = {
        "package": package_name,
        "version": _get_package_version(package_name),
        "wheel_url": wheel_url,
    }
    path = _marker_path(dest_root, package_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as outfile:
        json.dump(marker, outfile, ensure_ascii=True, indent=2)
        outfile.write("\n")


def _load_pypi_release(spec: dict) -> dict:
    project = spec["project"]
    version = spec["version"]
    url = f"https://pypi.org/pypi/{project}/{version}/json"

    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def _select_wheel_url(spec: dict) -> str:
    payload = _load_pypi_release(spec)
    urls = payload.get("urls") or []

    preferred = []
    fallback = []

    for item in urls:
        if item.get("packagetype") != "bdist_wheel":
            continue

        filename = item.get("filename") or ""
        url = item.get("url")
        if not url:
            continue

        if filename.endswith("none-any.whl"):
            preferred.append(url)
        else:
            fallback.append(url)

    if preferred:
        return preferred[0]

    if fallback:
        return fallback[0]

    raise RuntimeError(
        f"No wheel asset found on PyPI for {spec['project']}=={spec['version']}"
    )


def _download_and_extract_wheel(package_name: str, dest_root: Path, spec: dict) -> Path:
    wheel_url = _select_wheel_url(spec)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".whl") as tmp_file:
        wheel_path = Path(tmp_file.name)

    try:
        with urllib.request.urlopen(wheel_url, timeout=120) as response, open(wheel_path, "wb") as outfile:
            shutil.copyfileobj(response, outfile)

        with zipfile.ZipFile(wheel_path, "r") as zip_ref:
            zip_ref.extractall(dest_root)
    finally:
        wheel_path.unlink(missing_ok=True)

    _write_download_marker(dest_root, package_name, wheel_url)
    return dest_root / package_name


def ensure_runtime_python_path() -> Path:
    runtime_package_root = get_runtime_package_root()
    runtime_package_root.mkdir(parents=True, exist_ok=True)
    runtime_root_str = str(runtime_package_root)

    if runtime_root_str not in sys.path:
        sys.path.insert(0, runtime_root_str)

    return runtime_package_root


def bootstrap_packaged_runtime() -> None:
    if not is_packaged_backend():
        return

    ensure_runtime_python_path()


def ensure_runtime_dependency_overlay(package_name: str) -> Path | None:
    if not is_packaged_backend():
        return _get_package_root(package_name)

    runtime_package_root = ensure_runtime_python_path()
    dest_root = runtime_package_root / package_name

    if dest_root.exists():
        return dest_root

    source_root = _get_package_root(package_name)

    if source_root is None:
        spec = get_runtime_package_spec(package_name)

        if spec and spec.get("install_mode") == "pypi_wheel":
            return _download_and_extract_wheel(package_name, runtime_package_root, spec)

        raise RuntimeError(f"Cannot resolve packaged dependency: {package_name}")

    if source_root == dest_root:
        return dest_root

    if source_root.is_dir():
        shutil.copytree(source_root, dest_root)
    else:
        dest_root.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_root, dest_root / source_root.name)

    _write_marker(runtime_package_root, package_name, source_root)
    return dest_root


def prepare_packaged_runtime_dependencies(package_names: list[str]) -> None:
    if not is_packaged_backend():
        return

    ensure_runtime_python_path()

    for package_name in package_names:
        ensure_runtime_dependency_overlay(package_name)
