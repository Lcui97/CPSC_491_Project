"""Turn textbook chunks or OCR markdown into note rows in the database."""
import uuid
from typing import List, Dict, Any

from app.extensions import db
from app.models.brain import Node
from app.services.openai_service import generate_node_from_chunk
from app.services.chunker import Chunk


def _chunk_to_node_payload(chunk: Chunk) -> Dict[str, Any]:
    """LLM pass to title/summarize/tag one chunk."""
    out = generate_node_from_chunk(chunk.text, chunk.section_title)
    return {
        "title": out.get("title") or chunk.section_title or "Untitled",
        "summary": out.get("summary") or "",
        "concepts": out.get("concepts") or [],
        "section_title": chunk.section_title,
        "raw_content": chunk.text[:10000],
    }


def _markdown_to_single_node(markdown: str, source_file_id: int | None) -> Dict[str, Any]:
    """OCR-style blob: one note, same LLM metadata pass (trimmed for token budget)."""
    out = generate_node_from_chunk(markdown[:6000])
    return {
        "title": out.get("title") or "Handwritten note",
        "summary": out.get("summary") or "",
        "concepts": out.get("concepts") or [],
        "section_title": None,
        "raw_content": markdown,
        "source_file_id": source_file_id,
    }


def generate_and_store_nodes(
    brain_id: str,
    user_id: int,
    chunks: List[Dict[str, Any]] | None = None,
    markdown: str | None = None,
    source_file_id: int | None = None,
    node_type: str | None = None,
) -> dict:
    """Either many chunks from a textbook upload, or one markdown string from OCR."""
    if chunks:
        payloads = []
        for c in chunks:
            chunk_obj = Chunk(
                text=c.get("text") or "",
                section_title=c.get("section_title"),
            )
            payload = _chunk_to_node_payload(chunk_obj)
            payload["source_file_id"] = c.get("source_file_id") or source_file_id
            payloads.append(payload)
    elif markdown:
        pl = _markdown_to_single_node(markdown, source_file_id)
        if node_type:
            pl["node_type"] = node_type
        payloads = [pl]
    else:
        return {"nodes_created": 0, "node_ids": [], "links_created": 0}

    node_ids = [str(uuid.uuid4()) for _ in payloads]

    for i, p in enumerate(payloads):
        raw = payloads[i].get("raw_content") or ""
        node = Node(
            id=node_ids[i],
            brain_id=brain_id,
            source_file_id=p.get("source_file_id"),
            title=payloads[i]["title"][:512],
            summary=payloads[i].get("summary"),
            raw_content=raw,
            markdown_content=raw if raw else None,
            concepts=payloads[i].get("concepts"),
            section_title=(payloads[i].get("section_title") or "")[:512] or None,
            tags=payloads[i].get("concepts"),
            node_type=p.get("node_type") or "note",
            embedding_id=None,
            metadata_json={
                "source_reference": str(p.get("source_file_id") or ""),
                "tags": payloads[i].get("concepts"),
            },
            related_node_ids=None,
        )
        db.session.add(node)
    db.session.commit()

    return {
        "nodes_created": len(node_ids),
        "node_ids": node_ids,
        "links_created": 0,
    }
