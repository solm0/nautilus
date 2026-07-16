from __future__ import annotations

from pathlib import Path

from .language_packs import (
    get_language_package_ids,
    get_model_resource_ids,
    get_resource_package_ids,
    get_runtime_resource_plan,
    get_shared_dependency_ids,
)
from .runtime_state import add_consumer, ensure_state_dirs, get_consumers, remove_consumer


def mark_runtime_consumers(state_root: Path, lang: str) -> None:
    ensure_state_dirs(state_root)

    for dependency_id in get_shared_dependency_ids(lang):
        add_consumer(state_root, "resources", dependency_id, lang)

    for package_id in get_language_package_ids(lang):
        add_consumer(state_root, "packages", package_id, lang)

    for package_id in get_resource_package_ids(lang):
        add_consumer(state_root, "resources", package_id, lang)

    for resource_id in get_model_resource_ids(lang):
        add_consumer(state_root, "models", resource_id, lang)


def unmark_runtime_consumers(state_root: Path, lang: str) -> None:
    ensure_state_dirs(state_root)

    for dependency_id in get_shared_dependency_ids(lang):
        remove_consumer(state_root, "resources", dependency_id, lang)

    for package_id in get_language_package_ids(lang):
        remove_consumer(state_root, "packages", package_id, lang)

    for package_id in get_resource_package_ids(lang):
        remove_consumer(state_root, "resources", package_id, lang)

    for resource_id in get_model_resource_ids(lang):
        remove_consumer(state_root, "models", resource_id, lang)


def get_runtime_state_snapshot(state_root: Path, lang: str) -> dict:
    plan = get_runtime_resource_plan(lang)

    return {
        "shared_dependencies": {
            resource_id: get_consumers(state_root, "resources", resource_id)
            for resource_id in plan["shared_dependencies"]
        },
        "language_packages": {
            package_id: get_consumers(state_root, "packages", package_id)
            for package_id in plan["language_packages"]
        },
        "resource_packages": {
            package_id: get_consumers(state_root, "resources", package_id)
            for package_id in plan["resource_packages"]
        },
        "model_resources": {
            resource_id: get_consumers(state_root, "models", resource_id)
            for resource_id in plan["model_resources"]
        },
    }
