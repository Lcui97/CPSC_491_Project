"""Vector index wrapper — if there's no API key, every call is a quiet no-op so dev still works."""
import os
from typing import List, Dict, Any

try:
    from pinecone import Pinecone
except (ImportError, Exception):
    # Old pinecone-client package blows up on import; treat as missing
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
    """Push vectors into this brain's namespace; metadata gets flattened to Pinecone-safe types."""
    index = _index()
    if index is None:
        return
    # Pinecone only likes primitives in metadata
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
    """Nearest neighbours in this brain's namespace, score-filtered; empty list if Pinecone is off."""
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


def delete_brain_namespace(brain_id: str) -> None:
    """Wipe the whole namespace — used when a brain is deleted."""
    index = _index()
    if index is None:
        return
    ns = str(brain_id)
    try:
        if hasattr(index, "delete_namespace"):
            index.delete_namespace(namespace=ns)
        else:
            index.delete(delete_all=True, namespace=ns)
    except Exception:
        try:
            index.delete(delete_all=True, namespace=ns)
        except Exception:
            pass


def delete_vectors(brain_id: str, vector_ids: list) -> None:
    """Drop specific ids; harmless if we're not wired to Pinecone."""
    index = _index()
    if index is None or not vector_ids:
        return
    clean = [str(v) for v in vector_ids if v]
    if not clean:
        return
    index.delete(ids=clean, namespace=brain_id)
