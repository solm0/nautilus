import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.lemmas_router import router as lemmas_router
from routers.lang_router import router as lang_router
from routers.content_router import router as content_router
from routers.pattern_router import router as pattern_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost",        # Electron
        "https://localhost",       # Capacitor Android WebView
        "capacitor://localhost",   # Capacitor iOS WebView
        "file://",                 # Electron file 프로토콜
    ],
    allow_origin_regex=r"chrome-extension://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(content_router)
app.include_router(lemmas_router)
app.include_router(lang_router)
app.include_router(pattern_router)
