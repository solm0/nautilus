from __future__ import annotations

import json
from pathlib import Path


def ensure_state_dirs(state_root: Path) -> None:
    for name in ("resources", "models", "packages", "languages"):
        (state_root / name).mkdir(parents=True, exist_ok=True)


def _state_path(state_root: Path, kind: str, resource_id: str) -> Path:
    return state_root / kind / f"{resource_id}.json"


def read_state(state_root: Path, kind: str, resource_id: str) -> dict:
    path = _state_path(state_root, kind, resource_id)

    if not path.exists():
        return {
            "id": resource_id,
            "consumers": [],
        }

    with open(path, encoding="utf-8") as infile:
        data = json.load(infile)

    consumers = data.get("consumers") or []
    return {
        "id": data.get("id") or resource_id,
        "consumers": sorted({consumer for consumer in consumers if consumer}),
    }


def write_state(state_root: Path, kind: str, resource_id: str, state: dict) -> dict:
    ensure_state_dirs(state_root)
    path = _state_path(state_root, kind, resource_id)
    payload = {
        "id": resource_id,
        "consumers": sorted({consumer for consumer in state.get("consumers", []) if consumer}),
    }

    with open(path, "w", encoding="utf-8") as outfile:
        json.dump(payload, outfile, ensure_ascii=True, indent=2)
        outfile.write("\n")

    return payload


def add_consumer(state_root: Path, kind: str, resource_id: str, consumer: str) -> dict:
    state = read_state(state_root, kind, resource_id)
    consumers = set(state.get("consumers", []))
    consumers.add(consumer)
    state["consumers"] = sorted(consumers)
    return write_state(state_root, kind, resource_id, state)


def remove_consumer(state_root: Path, kind: str, resource_id: str, consumer: str) -> dict:
    state = read_state(state_root, kind, resource_id)
    consumers = {item for item in state.get("consumers", []) if item != consumer}
    state["consumers"] = sorted(consumers)
    return write_state(state_root, kind, resource_id, state)


def get_consumers(state_root: Path, kind: str, resource_id: str) -> list[str]:
    return read_state(state_root, kind, resource_id).get("consumers", [])
