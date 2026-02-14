"""
Orchestrate document ingestion at Brain creation or via /brain/ingest.
- PDF → extract text → chunk → generate nodes → Pinecone + DB
- Text/Markdown → chunk (or single) → generate nodes → Pinecone + DB
"""
import io
import uuid
from typing import List

from app.extensions import db
from app.models.brain import Brain, SourceFile
from app.services.pdf_extractor import extract_text_from_pdf
from app.services.chunker import chunk_by_sections
from app.services.node_generation import generate_and_store_nodes


ALLOWED_EXTENSIONS = {"pdf", "txt", "md", "markdown", "jpg", "jpeg", "png"}
PDF_EXT = {"pdf"}
TEXT_EXT = {"txt", "md", "markdown"}
IMAGE_EXT = {"jpg", "jpeg", "png"}


def _file_type(extension: str) -> str:
    if extension in PDF_EXT:
        return "pdf"
    if extension in IMAGE_EXT:
        return "image"
    if extension in TEXT_EXT:
        return "text" if extension == "txt" else "markdown"
    return "text"


def _ensure_source_file(brain_id: str, filename: str, file_type: str) -> SourceFile:
    sf = SourceFile(
        brain_id=brain_id,
        filename=filename,
        file_type=file_type,
        storage_path=None,
    )
    db.session.add(sf)
    db.session.flush()  # get sf.id
    return sf


def process_creation_files(brain_id: str, user_id: int, files: List) -> dict:
    """
    Called when Brain is created with optional files. Process each file and create nodes.
    """
    return ingest_documents(brain_id, user_id, files)


def ingest_documents(brain_id: str, user_id: int, files: List) -> dict:
    """
    Ingest a list of Flask FileStorage objects into the given Brain.
    - PDF/text/md: extract or read → chunk → generate nodes
    - Image: skip here; client should use /brain/ocr then /brain/generate-nodes with markdown
    """
    total_nodes = 0
    total_links = 0
    errors = []

    for file in files:
        if not file or not file.filename:
            continue
        ext = (file.filename.split(".")[-1] or "").lower()
        if ext not in ALLOWED_EXTENSIONS:
            errors.append(f"Unsupported format: {file.filename}")
            continue

        ft = _file_type(ext)
        if ft == "image":
            # Handwritten: client uses OCR endpoint then generate-nodes with markdown
            errors.append(f"Use OCR flow for images: {file.filename}")
            continue

        try:
            source_file = _ensure_source_file(brain_id, file.filename, ft)
            if ft == "pdf":
                text = extract_text_from_pdf(file.stream)
            else:
                text = file.read().decode("utf-8", errors="replace")

            if not text.strip():
                errors.append(f"Empty or unreadable: {file.filename}")
                continue

            chunks = chunk_by_sections(text)
            chunk_dicts = [
                {
                    "text": c.text,
                    "section_title": c.section_title,
                    "source_file_id": source_file.id,
                }
                for c in chunks
            ]
            result = generate_and_store_nodes(
                brain_id=brain_id,
                user_id=user_id,
                chunks=chunk_dicts,
                source_file_id=source_file.id,
            )
            total_nodes += result.get("nodes_created", 0)
            total_links += result.get("links_created", 0)
        except Exception as e:
            errors.append(f"{file.filename}: {e}")

    db.session.commit()
    return {
        "nodes_created": total_nodes,
        "links_created": total_links,
        "errors": errors,
    }
