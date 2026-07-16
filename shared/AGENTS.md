# Shared Guide

## Purpose

`shared` contains Python service logic intended to be reused or mirrored between local and central server behavior.

## When to read this folder

- The same language-processing bug appears in both `backend` and `central`
- You are deduplicating or comparing service behavior across the two servers
- A server service imports or mirrors logic from here

## Usually do not start here

- If the issue is clearly local-only, begin in `backend`
- If the issue is clearly cloud/mobile-only, begin in `central`

## Start here

- `services/`: lemma, IPA, NLP, prediction, and pattern services
- `manifests/`: shared language-pack metadata, runtime dependency manifests, state/refcount helpers

## Notes

- Names mirror service modules under `backend/services` and `central/services`
- Before editing, confirm whether this folder is actually imported by the target app or just kept in sync manually
- If a shared service touches language-pack files, do not hardcode `backend/data/static` as the only source
- Shared path resolution must work for both local `backend` and cloud `central`, or accept an explicit override such as `NAUTILUS_DATA_STATIC_ROOT`
- `shared/manifests/language_packs.py` is the source of truth for language runtime definitions
- Runtime state/refcount logic lives under `shared/manifests/runtime_state.py`, `runtime_tracking.py`, and `runtime_installer.py`
- Add or change language runtime requirements in `shared/manifests` first, then update callers in `backend`, `central`, or `electron` only if the execution policy changes
