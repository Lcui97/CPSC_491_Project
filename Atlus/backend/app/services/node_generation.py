"""
Generate nodes from chunks or markdown: OpenAI → Pinecone → Postgres, then link by similarity.
"""
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
    """Call OpenAI to get title, summary, concepts, related_topics for one chunk."""
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
    """Treat full markdown as one node; generate title/summary/concepts via OpenAI."""
    # Use first 6k chars for generation
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
) -> dict:
    """
    chunks: list of { "text", "section_title?", "source_file_id?" } (from textbook pipeline).
    markdown: single document (e.g. from OCR); creates one node.
    - Generate node payloads via OpenAI
    - Create embeddings, upsert to Pinecone
    - Insert Node rows in Postgres with embedding_id
    - Run similarity search per node and create relationships (related_node_ids + NodeRelationship if used)
    """
    if chunks:
        # Textbook path: multiple chunks
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

    # Embedding text: title + summary + key concepts
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

    # Persist nodes in Postgres
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
            embedding_id=node_ids[i],
            metadata_json={
                "source_reference": str(p.get("source_file_id") or ""),
                "tags": payloads[i].get("concepts"),
            },
            related_node_ids=[],
        )
        db.session.add(node)
    db.session.commit()

    # Link nodes by similarity
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
