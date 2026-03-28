"""Handwriting → markdown: try vision first, fall back to EasyOCR + a cheap structuring pass."""
import io
import logging
from typing import List

try:
    import easyocr
except ImportError:
    easyocr = None

from app.services.openai_service import (
    _has_openai,
    generate_markdown_structure,
    handwriting_image_to_markdown,
)

log = logging.getLogger(__name__)

_reader = None


def _get_reader(lang: List[str] = None):
    global _reader
    if _reader is None:
        if easyocr is None:
            raise RuntimeError("easyocr required for OCR fallback: pip install easyocr")
        _reader = easyocr.Reader(lang or ["en"], gpu=False)
    return _reader


def _image_to_text_easyocr(image_bytes: bytes) -> str:
    """EasyOCR path — plain text, no LLM."""
    reader = _get_reader()
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    arr = np.array(img)
    results = reader.readtext(arr)
    lines = []
    for (bbox, text, conf) in results:
        if text and str(text).strip() and (conf is None or conf >= 0.15):
            lines.append(str(text).strip())
    return "\n".join(lines)


def _pdf_pages_to_images(pdf_bytes: bytes) -> List[bytes]:
    """Placeholder for rasterizing PDF pages (scanned syllabi, etc.)."""
    try:
        from PyPDF2 import PdfReader
    except Exception:
        pass
    return []


def _image_ocr_markdown(image_bytes: bytes, filename: str) -> dict:
    """Try vision first, then EasyOCR + markdown cleanup — same payload shape as the public entrypoint."""
    if _has_openai():
        try:
            markdown, raw_preview = handwriting_image_to_markdown(image_bytes, filename)
            if markdown.strip():
                return {
                    "markdown": markdown,
                    "raw_text": raw_preview,
                    "preview_url": None,
                    "ocr_engine": "openai_vision",
                }
        except Exception as e:
            log.warning("Vision handwriting OCR failed, falling back to EasyOCR: %s", e)

    if easyocr is None:
        return {
            "markdown": "*OCR unavailable.* Add `OPENAI_API_KEY` for vision handwriting OCR, or install `easyocr` for a local fallback.",
            "raw_text": "",
            "preview_url": None,
            "ocr_engine": None,
        }

    raw_text = _image_to_text_easyocr(image_bytes)
    if not raw_text.strip():
        return {"markdown": "", "raw_text": "", "preview_url": None, "ocr_engine": "easyocr"}

    markdown = generate_markdown_structure(raw_text)
    return {
        "markdown": markdown,
        "raw_text": raw_text[:5000],
        "preview_url": None,
        "ocr_engine": "easyocr",
    }


def run_ocr_to_markdown(file) -> dict:
    """Image or PDF upload → markdown + preview fields for the client."""
    try:
        filename = (file.filename or "").lower()
        data = file.read()
        if not data:
            return {"markdown": "", "raw_text": "", "preview_url": None}

        if filename.endswith(".pdf"):
            raw_text = ""
            try:
                from app.services.pdf_extractor import extract_text_from_pdf_bytes

                raw_text = extract_text_from_pdf_bytes(data)
            except Exception:
                pass
            if len(raw_text.strip()) < 100:
                images = _pdf_pages_to_images(data)
                if images:
                    return _image_ocr_markdown(images[0], "page.png")
                raw_text = raw_text or "(PDF could not be read. Upload PNG/JPEG photos of pages for best handwriting results.)"

            if not raw_text.strip():
                return {"markdown": "", "raw_text": "", "preview_url": None}

            markdown = generate_markdown_structure(raw_text) if _has_openai() else raw_text.strip()
            return {
                "markdown": markdown,
                "raw_text": raw_text[:5000],
                "preview_url": None,
                "ocr_engine": "pdf_text",
            }

        return _image_ocr_markdown(data, filename)

    except Exception as e:
        log.exception("run_ocr_to_markdown failed")
        return {
            "markdown": f"*OCR failed:* {str(e)}. Ensure `OPENAI_API_KEY` is set for vision OCR, or install `easyocr` for fallback.",
            "raw_text": "",
            "preview_url": None,
        }
