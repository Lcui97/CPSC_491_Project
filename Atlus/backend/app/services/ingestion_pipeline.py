"""Wire up PDF/text uploads: extract, chunk, then node generation + vectors + DB."""
import io
import uuid
from pathlib import Path
from typing import List

from flask import current_app
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.brain import SourceFile
from app.services.pdf_extractor import extract_text_from_pdf, extract_text_from_pdf_fitz
from app.services.docx_extractor import extract_text_from_docx
from app.services.pptx_extractor import extract_text_from_pptx
from app.services.chunker import chunk_by_sections
from app.services.node_generation import generate_and_store_nodes


ALLOWED_EXTENSIONS = {
    "pdf",
    "txt",
    "md",
    "markdown",
    "docx",
    "pptx",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "tif",
    "tiff",
}
PDF_EXT = {"pdf"}
TEXT_EXT = {"txt", "md", "markdown"}
DOCX_EXT = {"docx"}
PPTX_EXT = {"pptx"}
IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff"}


def _file_type(extension: str) -> str:
    if extension in PDF_EXT:
        return "pdf"
    if extension in DOCX_EXT:
        return "docx"
    if extension in PPTX_EXT:
        return "pptx"
    if extension in IMAGE_EXT:
        return "image"
    if extension in TEXT_EXT:
        return "text" if extension == "txt" else "markdown"
    return "text"


def _upload_root():
    return Path(current_app.root_path).parent / current_app.config.get("UPLOAD_FOLDER", "uploads")


def _persist_image_on_disk(brain_id: str, filename: str, ext: str, data: bytes) -> SourceFile:
    """Save scan bytes and return a committed SourceFile row (same layout as /brain/ocr)."""
    root = _upload_root()
    brain_dir = root / brain_id
    brain_dir.mkdir(parents=True, exist_ok=True)
    uid = str(uuid.uuid4())
    dot_ext = ext if ext.startswith(".") else f".{ext}"
    fname = f"{uid}{dot_ext}"
    full_path = brain_dir / fname
    full_path.write_bytes(data)
    rel = f"{brain_id}/{fname}"
    sf = SourceFile(
        brain_id=brain_id,
        filename=filename,
        file_type="image",
        storage_path=rel,
    )
    db.session.add(sf)
    db.session.commit()
    return sf


def _ensure_source_file(brain_id: str, filename: str, file_type: str) -> SourceFile:
    sf = SourceFile(
        brain_id=brain_id,
        filename=filename,
        file_type=file_type,
        storage_path=None,
    )
    db.session.add(sf)
    db.session.flush()  # need source_files.id for nodes
    return sf


def process_creation_files(brain_id: str, user_id: int, files: List) -> dict:
    """Same as ingest_documents — used from the “create brain + files” path."""
    return ingest_documents(brain_id, user_id, files)


def ingest_documents(brain_id: str, user_id: int, files: List) -> dict:
    """PDFs/docs → chunks; photos (jpg/png/…) → OCR + one handwritten node with the file saved."""
    try:
        db.session.rollback()
    except Exception:
        pass
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
            try:
                data = file.read()
                if not data:
                    errors.append(f"Empty file: {file.filename}")
                    continue
                sf = _persist_image_on_disk(brain_id, file.filename or "scan.png", ext, data)
                bio = io.BytesIO(data)
                bio.seek(0)
                fs = FileStorage(stream=bio, filename=file.filename or "upload.png")
                from app.services.ocr_service import run_ocr_to_markdown

                ocr_out = run_ocr_to_markdown(fs)
                md = (ocr_out.get("markdown") or "").strip()
                if not md:
                    errors.append(f"No text extracted from image: {file.filename}")
                    continue
                result = generate_and_store_nodes(
                    brain_id=brain_id,
                    user_id=user_id,
                    markdown=md,
                    source_file_id=sf.id,
                    node_type="handwritten",
                )
                total_nodes += result.get("nodes_created", 0)
                total_links += result.get("links_created", 0)
            except Exception as e:
                errors.append(f"{file.filename}: {e}")
            continue

        try:
            if ft == "pdf":
                if hasattr(file, "stream") and file.stream is not None:
                    try:
                        file.stream.seek(0)
                    except (OSError, ValueError, AttributeError):
                        pass
                    pdf_bytes = file.stream.read()
                else:
                    pdf_bytes = file.read()
                if not pdf_bytes:
                    errors.append(f"Empty file: {file.filename}")
                    continue
                source_file = _ensure_source_file(brain_id, file.filename, ft)
                text = extract_text_from_pdf(io.BytesIO(pdf_bytes))
                if not text.strip():
                    text = extract_text_from_pdf_fitz(pdf_bytes)
                if not text.strip():
                    from app.services.ocr_service import ocr_scanned_pdf_to_plain_text

                    text = ocr_scanned_pdf_to_plain_text(pdf_bytes)
                if not text.strip():
                    errors.append(
                        f"No extractable text in PDF (often a scan): {file.filename}. "
                        "Install pymupdf (`pip install pymupdf`), set OPENAI_API_KEY for vision OCR, "
                        "or rely on EasyOCR for local page OCR."
                    )
                    continue
            else:
                if hasattr(file, "stream") and file.stream is not None:
                    try:
                        file.stream.seek(0)
                    except (OSError, ValueError, AttributeError):
                        pass
                source_file = _ensure_source_file(brain_id, file.filename, ft)
                if ft == "docx":
                    text = extract_text_from_docx(file.stream)
                elif ft == "pptx":
                    text = extract_text_from_pptx(file.stream)
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
