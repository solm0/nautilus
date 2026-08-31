from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from library_store import LibraryStore


router = APIRouter(prefix="/api/library", tags=["local-library"])


def store() -> LibraryStore:
    return LibraryStore()


class NamePayload(BaseModel):
    name: str


class MovePayload(BaseModel):
    page_ids: list[str]
    notebook_id: str | None = None


class MetadataPayload(BaseModel):
    metadata: list[str]


class ContentPayload(BaseModel):
    content: str


@router.get("/pages")
def list_pages():
    return store().list_pages()


@router.post("/pages")
def create_page(payload: dict):
    if "result" not in payload or not payload.get("language"):
        raise HTTPException(400, "result and language are required")
    return {"id": store().create_page(payload)}


@router.get("/pages/{page_id}")
def get_page(page_id: str):
    page = store().get_page(page_id)
    if page is None:
        raise HTTPException(404, "page not found")
    return page


@router.patch("/pages/{page_id}")
def rename_page(page_id: str, payload: NamePayload):
    if not payload.name.strip():
        raise HTTPException(400, "name is required")
    if not store().rename_page(page_id, payload.name):
        raise HTTPException(404, "page not found")
    return {"ok": True}


@router.delete("/pages/{page_id}")
def delete_page(page_id: str):
    if not store().delete_page(page_id):
        raise HTTPException(404, "page not found")
    return {"ok": True}


@router.put("/pages/{page_id}/metadata")
def update_metadata(page_id: str, payload: MetadataPayload):
    try:
        return {"metadata": store().update_metadata(page_id, payload.metadata)}
    except KeyError:
        raise HTTPException(404, "page not found")


@router.post("/pages/move")
def move_pages(payload: MovePayload):
    store().move_pages(payload.page_ids, payload.notebook_id)
    return {"ok": True}


@router.get("/notebooks")
def list_notebooks():
    return store().list_notebooks()


@router.post("/notebooks")
def create_notebook(payload: NamePayload):
    if not payload.name.strip():
        raise HTTPException(400, "name is required")
    return store().create_notebook(payload.name)


@router.patch("/notebooks/{notebook_id}")
def rename_notebook(notebook_id: str, payload: NamePayload):
    if not store().rename_notebook(notebook_id, payload.name):
        raise HTTPException(404, "notebook not found")
    return {"ok": True}


@router.delete("/notebooks/{notebook_id}")
def delete_notebook(notebook_id: str):
    if not store().delete_notebook(notebook_id):
        raise HTTPException(404, "notebook not found")
    return {"ok": True}


@router.get("/annotations")
def list_annotations():
    return {"items": store().list_annotations(), "next_cursor": None}


@router.post("/annotations")
def create_annotation(payload: dict):
    try:
        return store().create_annotation(payload)
    except (KeyError, ValueError, TypeError) as error:
        raise HTTPException(400, str(error))


@router.patch("/annotations/{annotation_id}")
def update_annotation(annotation_id: str, payload: ContentPayload):
    annotation = store().update_annotation(annotation_id, payload.content)
    if annotation is None:
        raise HTTPException(404, "annotation not found")
    return annotation


@router.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: str):
    if not store().delete_annotation(annotation_id):
        raise HTTPException(404, "annotation not found")
    return {"ok": True}


@router.get("/export")
def export_library():
    return store().export_bundle()


@router.post("/import")
def import_library(payload: dict):
    try:
        return store().import_bundle(payload)
    except ValueError as error:
        raise HTTPException(400, str(error))


@router.get("/meta/{key}")
def get_meta(key: str):
    return {"value": store().get_meta(key)}


@router.put("/meta/{key}")
def set_meta(key: str, payload: dict):
    store().set_meta(key, str(payload.get("value") or ""))
    return {"ok": True}
