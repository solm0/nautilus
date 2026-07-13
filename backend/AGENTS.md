# Backend Guide

## Purpose

`backend` is the local FastAPI server. Electron talks to this server on localhost for local analysis and dictionary-style features.

## Start here

- `main.py`: app setup, CORS, router registration
- `routers/`: API surface
- `services/`: local business logic
- `language_config/`: per-language setup

## When to use this folder

- Fixing local API behavior
- Desktop-local analysis or lookup issues
- Electron calling a localhost API
- Local content endpoints

## Usually do not read first

- `central` unless the same bug appears in cloud/mobile flows
- `preprocess` or `releases` unless the issue is in generated language data

## Notes

- CORS explicitly allows Electron, Capacitor localhost origins, and Chrome extensions
- Service names overlap with `shared` and `central`; confirm whether the change is local-only before copying logic across apps
