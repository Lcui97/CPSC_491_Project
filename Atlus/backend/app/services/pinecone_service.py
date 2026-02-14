"""
Pinecone: store and query embeddings for node linking and similarity search.
When PINECONE_API_KEY is not set, _index() returns None and upsert/search no-op (run locally).
"""
import os
from typing import List, Dict, Any

try:
    from pinecone import Pinecone
except (ImportError, Exception):
    # Exception: old package "pinecone-client" raises when imported (renamed to "pinecone")
    Pinecone = None

_index_name = None
_pc = None
_index_obj = None


def _index():
    global _pc, _index_name, _index_obj
    key = os.environ.get("PINECONE_API_KEY", "").strip()
    if not key or Pinecone is None:
        return None
    if _pc is None:
        _pc = Pinecone(api_key=key)
    if _index_name is None:
        _index_name = os.environ.get("PINECONE_INDEX", "atlus-brain")
    if _index_obj is None:
        _index_obj = _pc.Index(_index_name)
    return _index_obj


def upsert_vectors(
    brain_id: str,
    vectors: List[List[float]],
    ids: List[str],
    metadatas: List[Dict[str, Any]],
) -> None:
    """
    Upsert embedding vectors with metadata (brain_id, section_title, tags, source_reference, etc.).
    ids and metadatas must match length of vectors.
    """
    index = _index()
    if index is None:
        return  # local-only: skip Pinecone
    # Pinecone metadata values must be str | int | float | bool
    safe_meta = []
    for m in metadatas:
        safe = {}
        for k, v in m.items():
            if v is None:
                continue
            if isinstance(v, (str, int, float, bool)):
                safe[k] = v
            else:
                safe[k] = str(v)
        safe_meta.append(safe)

    records = [
        {"id": ids[i], "values": vectors[i], "metadata": safe_meta[i]}
        for i in range(len(vectors))
    ]
    index.upsert(vectors=records, namespace=brain_id)


def similarity_search(
    brain_id: str,
    embedding: List[float],
    top_k: int = 5,
    threshold: float = 0.75,
    exclude_ids: List[str] | None = None,
) -> List[Dict[str, Any]]:
    """
    Query by vector; return matches with score >= threshold, filtered by brain_id.
    exclude_ids: node ids to exclude (e.g. self). Returns [] when Pinecone not configured.
    """
    index = _index()
    if index is None:
        return []
    result = index.query(
        vector=embedding,
        top_k=top_k + (len(exclude_ids or []) + 5),
        namespace=brain_id,
        include_metadata=True,
    )
    out = []
    seen = set(exclude_ids or [])
    for match in result.get("matches", []):
        mid = match.get("id")
        if mid in seen:
            continue
        score = match.get("score") or 0
        if score < threshold:
            continue
        seen.add(mid)
        out.append({
            "id": mid,
            "score": score,
            "metadata": match.get("metadata") or {},
        })
        if len(out) >= top_k:
            break
    return out
