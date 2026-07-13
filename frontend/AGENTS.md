# Frontend Guide

## Purpose

`frontend` contains the main Vite React UI plus Capacitor mobile packaging, Chrome extension build config, and landing-page build output wiring.

## Start here

- `src/`: main app UI
- `package.json`: main dev/build/mobile scripts
- `vite.config.ts`: main web build
- `vite.extension.config.ts`: extension build
- `vite.landing.config.ts`: landing build that writes into `central/static/landing`
- `capacitor.config.ts`: mobile shell config

## When to use this folder

- Web UI changes
- Mobile UI changes
- Extension UI/build changes
- Frontend env var wiring

## Important boundaries

- `frontend/package.json` is the main app package
- `frontend/frontend/package.json` is a nested package; do not assume it is the active app unless the task points there explicitly
- Electron shell behavior belongs in `electron`, not here
- Central API contract changes belong in `central`; local analysis API contract changes belong in `backend`

## Useful scripts

- `npm run dev`
- `npm run build`
- `npm run build:extension`
- `npm run build:landing`
- `npm run cap:sync`
- `npm run cap:run:android`
- `npm run cap:run:ios`
