"""
OCR for handwritten notes: image → text → ChatGPT → structured Markdown.
"""
import io
import re
from typing import List

try:
    import easyocr
except ImportError:
    easyocr = None

from app.services.openai_service import generate_markdown_structure


_reader = None


def _get_reader(lang: List[str] = None):
    global _reader
    if _reader is None:
        if easyocr is None:
            raise RuntimeError("easyocr required for OCR: pip install easyocr")
        _reader = easyocr.Reader(lang or ["en"], gpu=False)
    return _reader


def _image_to_text(image_bytes: bytes) -> str:
    """Run OCR on image bytes; return raw text."""
    reader = _get_reader()
    # easyocr readtext expects file path or numpy array; we can use numpy from bytes
    import numpy as np
    from PIL import Image
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGB")
    arr = np.array(img)
    results = reader.readtext(arr)
    lines = []
    for (bbox, text, conf) in results:
        if text.strip():
            lines.append(text.strip())
    return "\n".join(lines)


def _pdf_pages_to_images(pdf_bytes: bytes) -> List[bytes]:
    """Convert first few PDF pages to image bytes for OCR (e.g. scanned PDF)."""
    try:
        from PyPDF2 import PdfReader
        import io
        reader = PdfReader(io.BytesIO(pdf_bytes))
        # PyPDF2 doesn't render to image; we need pdf2image or similar
        # For scaffold: if PDF, try extracting text first; if empty, we'd use pdf2image
    except Exception:
        pass
    # Optional: add pdf2image (poppler) for PDF→image. For now, treat PDF as unsupported for OCR path
    # and recommend user upload images. We can still accept PDF and return "Upload an image for OCR".
    return []


def run_ocr_to_markdown(file) -> dict:
    """
    file: Flask FileStorage (image or PDF).
    Returns: { "markdown": "...", "raw_text": "...", "preview_url": null }
    When OCR/OpenAI are unavailable (local-only), returns a short message in markdown.
    """
    try:
        filename = (file.filename or "").lower()
        data = file.read()
        if not data:
            return {"markdown": "", "raw_text": "", "preview_url": None}

        raw_text = ""
        if filename.endswith(".pdf"):
            try:
                from app.services.pdf_extractor import extract_text_from_pdf_bytes
                raw_text = extract_text_from_pdf_bytes(data)
            except Exception:
                pass
            if len(raw_text.strip()) < 100:
                images = _pdf_pages_to_images(data)
                if images:
                    raw_text = _image_to_text(images[0])
                else:
                    raw_text = raw_text or "(PDF could not be read. Upload images of pages for OCR.)"
        else:
            if easyocr is None:
                return {
                    "markdown": "*OCR is not available when running locally.* Install `easyocr` and add `OPENAI_API_KEY` for full support.",
                    "raw_text": "",
                    "preview_url": None,
                }
            raw_text = _image_to_text(data)

        if not raw_text.strip():
            return {"markdown": "", "raw_text": "", "preview_url": None}

        markdown = generate_markdown_structure(raw_text)
        return {
            "markdown": markdown,
            "raw_text": raw_text[:5000],
            "preview_url": None,
        }
    except Exception as e:
        return {
            "markdown": f"*OCR failed:* {str(e)}. For local-only runs, add `OPENAI_API_KEY` and install `easyocr` for image OCR.",
            "raw_text": "",
            "preview_url": None,
        }
