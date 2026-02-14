"""
Intelligent chunking of textbook/content: prefer splitting by section headers when possible.
"""
import re
from dataclasses import dataclass
from typing import List


@dataclass
class Chunk:
    text: str
    section_title: str | None = None
    start_page: int | None = None
    end_page: int | None = None


# Common patterns for section headers (numbered sections, chapter titles, etc.)
SECTION_PATTERNS = [
    re.compile(r"^(?:Chapter\s+\d+[.:]?\s*)(.+)$", re.IGNORECASE),
    re.compile(r"^(\d+\.\d*)\s+(.+)$"),  # 1.2 Section Name
    re.compile(r"^(\d+)\s+([A-Z][^.]+)$"),  # 1 Section Name
    re.compile(r"^([A-Z][A-Za-z\s]+)$"),  # ALL CAPS or Title Case line alone
    re.compile(r"^#+\s+(.+)$"),  # Markdown ##
]


def _is_likely_header(line: str) -> bool:
    line = line.strip()
    if not line or len(line) > 200:
        return False
    for pat in SECTION_PATTERNS:
        if pat.match(line):
            return True
    return False


def chunk_by_sections(text: str, max_chunk_chars: int = 2000, overlap: int = 100) -> List[Chunk]:
    """
    Split text by section headers when possible; otherwise by size with overlap.
    Returns list of Chunk with optional section_title.
    """
    if not text or not text.strip():
        return []

    lines = text.split("\n")
    chunks: List[Chunk] = []
    current_section: str | None = None
    current_text: List[str] = []
    current_len = 0

    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            if current_text:
                current_text.append("")
            continue

        if _is_likely_header(line_stripped) and (not current_text or current_len > 300):
            # Flush current chunk if we have content
            if current_text:
                chunk_text = "\n".join(current_text).strip()
                if chunk_text:
                    chunks.append(Chunk(text=chunk_text, section_title=current_section))
                current_text = []
                current_len = 0
            current_section = line_stripped[:500]
            current_text = [line]
            current_len = len(line)
            continue

        current_text.append(line)
        current_len += len(line) + 1

        if current_len >= max_chunk_chars:
            chunk_text = "\n".join(current_text).strip()
            if chunk_text:
                chunks.append(Chunk(text=chunk_text, section_title=current_section))
            # Keep overlap: last N chars for context
            overlap_lines = []
            overlap_len = 0
            for i in range(len(current_text) - 1, -1, -1):
                overlap_len += len(current_text[i]) + 1
                overlap_lines.insert(0, current_text[i])
                if overlap_len >= overlap:
                    break
            current_text = overlap_lines
            current_len = sum(len(l) + 1 for l in current_text)

    if current_text:
        chunk_text = "\n".join(current_text).strip()
        if chunk_text:
            chunks.append(Chunk(text=chunk_text, section_title=current_section))

    return chunks if chunks else [Chunk(text=text.strip(), section_title=None)]
