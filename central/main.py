import os
from pathlib import Path

import bootstrap_paths  # noqa: F401
from sqlalchemy import text

from db import engine, Base
from language_config.model_store import (
    download_model,
    ensure_model_directories,
    model_exists,
)
from packs import get_model_provider, list_languages
from runtime_paths import get_runtime_state_root
from shared.manifests import (
    ensure_runtime_ready,
    get_language_package_ids,
    get_resource_package_ids,
    get_shared_dependency_ids,
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.auth_router import router as auth_router
from routers.pages_router import router as pages_router
from routers.lemmas_router import router as lemmas_router
from routers.mutual_router import router as mutual_router
from routers.comment_router import router as comment_router
from routers.internal_router import router as internal_router
from routers.mobile_router import router as mobile_router
from routers.demo_router import router as demo_router
from routers.version_router import router as version_router

BASE_DIR = Path(__file__).resolve().parent
LANDING_DIR = BASE_DIR / "static" / "landing"

app = FastAPI()
STATE_ROOT = get_runtime_state_root()


def get_runtime_dependency_ids(lang: str) -> list[str]:
    ordered = []

    for dependency_id in get_shared_dependency_ids(lang):
        if dependency_id not in ordered:
            ordered.append(dependency_id)

    for package_id in get_language_package_ids(lang):
        if package_id not in ordered:
            ordered.append(package_id)

    for package_id in get_resource_package_ids(lang):
        if package_id not in ordered:
            ordered.append(package_id)

    return ordered


def ensure_language_models():
    ensure_model_directories()

    for lang in list_languages():
        if model_exists(lang):
            print(f"[skip] model exists: {lang}")
            ensure_runtime_ready(STATE_ROOT, lang, get_runtime_dependency_ids(lang))
            continue

        try:
            ensure_runtime_ready(STATE_ROOT, lang, get_runtime_dependency_ids(lang))

            if get_model_provider(lang) == "classla":
                print(f"[classla] downloading: {lang}")
                download_model(lang)

            else:
                print(f"[stanza] downloading: {lang}")
                download_model(lang)

        except Exception as e:
            print(f"Failed downloading {lang}: {e}")


ensure_language_models()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:8010",
        "http://127.0.0.1:8010",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(pages_router)
app.include_router(lemmas_router)
app.include_router(mutual_router)
app.include_router(comment_router)
app.include_router(internal_router)
app.include_router(mobile_router)
app.include_router(demo_router)
app.include_router(version_router)

Base.metadata.create_all(bind=engine)

def ensure_page_schema():
    with engine.begin() as conn:
        columns = {
            row[1]
            for row in conn.exec_driver_sql("PRAGMA table_info(pages)").fetchall()
        }

        if "source" not in columns:
            conn.execute(
                text("ALTER TABLE pages ADD COLUMN source VARCHAR NOT NULL DEFAULT 'user'")
            )

        if "metadata_json" not in columns:
            conn.execute(
                text("ALTER TABLE pages ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '[]'")
            )

ensure_page_schema()

if LANDING_DIR.exists():
    app.mount(
        "/",
        StaticFiles(directory=str(LANDING_DIR), html=True),
        name="landing",
    )
