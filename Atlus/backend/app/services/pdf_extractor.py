"""PDF → plain text via PyPDF2 (good enough for class docs)."""
import io

try:
    from PyPDF2 import PdfReader
except ImportError:
    PdfReader = None


def extract_text_from_pdf(file_stream) -> str:
    """Concatenate all pages from a seekable PDF stream."""
    if PdfReader is None:
        raise RuntimeError("PyPDF2 is required for PDF extraction. pip install PyPDF2")

    reader = PdfReader(file_stream)
    parts = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def extract_text_from_pdf_bytes(data: bytes) -> str:
    return extract_text_from_pdf(io.BytesIO(data))
