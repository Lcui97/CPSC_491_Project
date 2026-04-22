"""Pinecone cleanup only (legacy vectors from older installs). No new vectors are written."""
import os

try:
    from pinecone import Pinecone
except (ImportError, Exception):
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
    """Drop specific ids; harmless if Pinecone is not configured."""
    index = _index()
    if index is None or not vector_ids:
        return
    clean = [str(v) for v in vector_ids if v]
    if not clean:
        return
    index.delete(ids=clean, namespace=brain_id)
