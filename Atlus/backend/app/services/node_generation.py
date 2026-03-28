"""Chunk or markdown in, nodes + vectors + auto-links out."""
import uuid
from typing import List, Dict, Any

from app.extensions import db
from app.models.brain import Brain, Node, SourceFile
from app.services.openai_service import (
    generate_node_from_chunk,
    get_embedding,
    get_embeddings_batch,
)
from app.services.pinecone_service import upsert_vectors, similarity_search
from app.services.chunker import Chunk

# Similarity threshold above which we auto-create a relationship
LINK_THRESHOLD = 0.78


def _chunk_to_node_payload(chunk: Chunk) -> Dict[str, Any]:
    """LLM pass to title/summarize/tag one chunk."""
    out = generate_node_from_chunk(chunk.text, chunk.section_title)
    return {
        "title": out.get("title") or chunk.section_title or "Untitled",
        "summary": out.get("summary") or "",
        "concepts": out.get("concepts") or [],
        "related_topics": out.get("related_topics") or [],
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
        "related_topics": out.get("related_topics") or [],
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
    """Either many chunks from a textbook upload, or one markdown string from OCR — then vectors + DB + auto-links."""
    if chunks:
        # Textbook / multi-chunk path
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
        payloads = [_markdown_to_single_node(markdown, source_file_id)]
    else:
        return {"nodes_created": 0, "node_ids": [], "links_created": 0}

    # Build one string per node for the embedding model
    texts_for_embedding = []
    for p in payloads:
        t = f"{p['title']}\n{p['summary']}\n" + " ".join((p.get("concepts") or [])[:10])
        texts_for_embedding.append(t[:8000])

    embeddings = get_embeddings_batch(texts_for_embedding)
    if len(embeddings) != len(payloads):
        raise RuntimeError("Embedding count mismatch")

    node_ids = [str(uuid.uuid4()) for _ in payloads]
    metadatas = []
    for i, p in enumerate(payloads):
        metadatas.append({
            "brain_id": brain_id,
            "section_title": (p.get("section_title") or "")[:500],
            "tags": ",".join((p.get("concepts") or [])[:15]),
            "source_reference": str(p.get("source_file_id") or ""),
            "node_id": node_ids[i],
        })

    upsert_vectors(brain_id, embeddings, node_ids, metadatas)

    # Write rows
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
            embedding_id=node_ids[i],
            metadata_json={
                "source_reference": str(p.get("source_file_id") or ""),
                "tags": payloads[i].get("concepts"),
            },
            related_node_ids=[],
        )
        db.session.add(node)
    db.session.commit()

    # Stitch related_node_ids from near neighbours
    links_created = 0
    for i, node_id in enumerate(node_ids):
        emb = embeddings[i]
        similar = similarity_search(
            brain_id, emb, top_k=4, threshold=LINK_THRESHOLD, exclude_ids=[node_id]
        )
        if not similar:
            continue
        related_ids = [s["id"] for s in similar]
        node = Node.query.get(node_id)
        if node:
            node.related_node_ids = related_ids
            links_created += len(related_ids)
    db.session.commit()

    return {
        "nodes_created": len(node_ids),
        "node_ids": node_ids,
        "links_created": links_created,
    }


def relink_user_note(node_id: str, brain_id: str) -> None:
    """Re-embed after a manual save and refresh `related_node_ids` (no-op if APIs missing)."""
    node = Node.query.get(node_id)
    if not node or node.brain_id != brain_id:
        return
    tags = node.tags if node.tags is not None else (node.concepts or [])
    text = (
        f"{node.title or ''}\n{node.summary or ''}\n"
        + " ".join([str(t) for t in (tags or [])[:10]])
        + "\n"
        + (node.markdown_content or node.raw_content or "")
    )
    text = (text or "").strip()
    if not text:
        return
    try:
        emb = get_embedding(text[:8000])
    except Exception:
        return
    meta = {
        "brain_id": brain_id,
        "section_title": "",
        "tags": ",".join([str(x) for x in tags][:15]) if tags else "",
        "source_reference": str(node.source_file_id or ""),
        "node_id": node.id,
    }
    try:
        upsert_vectors(brain_id, [emb], [node.id], [meta])
        node.embedding_id = node.id
    except Exception:
        return
    try:
        similar = similarity_search(
            brain_id, emb, top_k=6, threshold=LINK_THRESHOLD, exclude_ids=[node_id]
        )
        node.related_node_ids = [s["id"] for s in similar]
    except Exception:
        pass
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
