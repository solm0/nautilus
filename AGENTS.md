# Repo Guide For Agents

## Read this first

This repository contains several apps and data pipelines in one tree. Do not scan the whole repo by default. Pick the smallest relevant area first, then expand only if the change crosses boundaries.
On every task, read the nearest relevant `AGENTS.md` before exploring code.

## Directory map

- `backend`: local FastAPI server used by Electron and local workflows
- `central`: central FastAPI server for accounts, shared content, landing pages, and mobile APIs
- `frontend`: Vite React app, Capacitor mobile shell, landing build, and Chrome extension build
- `electron`: desktop shell that launches the local backend and loads the frontend
- `shared`: Python service logic mirrored across local and central servers
- `preprocess`: corpus preprocessing scripts
- `releases`: generated language data and release artifacts

## Where to look by task

- Local analysis, lemma lookup, local content APIs: start in `backend`
- Auth, shared pages, mobile cloud APIs, landing pages: start in `central`
- Web or mobile UI, Capacitor, extension UI: start in `frontend`
- Desktop app boot, deep links, local player integration, packaged backend: start in `electron`
- Logic reused by both servers: inspect `shared` only if the same behavior appears in both `backend` and `central`
- Corpus or language data generation: start in `preprocess`, then check `releases` if needed

## Scope rules

- Prefer reading one app folder plus `shared` instead of reading all apps
- Ignore `node_modules`, build outputs, and generated assets unless the task is explicitly about build artifacts
- Only inspect `preprocess` and `releases` for data pipeline tasks
- Treat `frontend/frontend` as a separate nested package used for a narrow purpose; do not assume it is the main app

## Common cross-app paths

- `backend/main.py`: local API entrypoint
- `central/main.py`: central API entrypoint
- `frontend/package.json`: main frontend and Capacitor scripts
- `electron/main.js`: desktop process entrypoint
- `shared/manifests/language_packs.py`: shared source of truth for language runtime and pack metadata

## Workflow hint

When a user request is ambiguous, ask or infer the target surface first:

- desktop local
- central server
- mobile app
- chrome extension
- corpus pipeline

Then read only that area's `AGENTS.md`.
