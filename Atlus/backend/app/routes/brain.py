"""
Brain API: create, ingest documents, OCR, generate nodes.
- POST /brain/create — create Brain (optional initial documents in same request).
- POST /brain/ingest — ingest PDF/text/markdown into existing Brain (textbook pipeline).
- POST /brain/ocr — OCR image(s) and return structured markdown (handwritten notes pipeline).
- POST /brain/generate-nodes — from text/chunks, generate nodes + embeddings + store.
"""
import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models.brain import Brain, Node, NodeRelationship, SourceFile
from app.models.user import User

bp = Blueprint("brain", __name__)


def _get_user_or_404():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None
    user = User.query.get(user_id)
    if not user:
        return None
    return user


def _brain_for_user(brain_id, user_id):
    brain = Brain.query.filter_by(id=brain_id, user_id=user_id).first()
    return brain


# ---------------------------------------------------------------------------
# POST /brain/create
# Body: JSON { "name": "...", "badge": "Notes" }
# Optional: multipart with "files[]" for initial document ingestion at creation time
# ---------------------------------------------------------------------------
@bp.route("/brain/create", methods=["POST"])
@jwt_required()
def create_brain():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    # Support both JSON (name only) and multipart (name + files)
    if request.is_json:
        data = request.get_json() or {}
        name = (data.get("name") or "").strip() or "New Brain"
        badge = (data.get("badge") or "Notes").strip()
        files = []
    else:
        name = (request.form.get("name") or "").strip() or "New Brain"
        badge = (request.form.get("badge") or "Notes").strip()
        files = request.files.getlist("files[]") or request.files.getlist("files") or []

    brain_id = str(uuid.uuid4())
    brain = Brain(id=brain_id, name=name, badge=badge, user_id=user.id)
    db.session.add(brain)
    db.session.commit()

    try:
        from app.services.seed_nodes import ensure_seed_nodes
        ensure_seed_nodes(brain_id)
    except Exception:
        pass

    # Optional: if files were provided at creation time, run ingestion pipeline
    if files:
        try:
            from app.services.ingestion_pipeline import process_creation_files
            process_creation_files(brain_id, user.id, files)
        except Exception as e:
            # Still return 201; ingestion can be retried via /brain/ingest
            pass

    return jsonify({
        "brain": {
            "id": brain.id,
            "name": brain.name,
            "badge": brain.badge,
            "created_at": brain.created_at.isoformat() if brain.created_at else None,
        }
    }), 201


# ---------------------------------------------------------------------------
# POST /brain/ingest
# Multipart: brain_id (form), files[] (PDF, .txt, .md)
# Textbook pipeline: extract → chunk → generate nodes → Pinecone + DB
# ---------------------------------------------------------------------------
@bp.route("/brain/ingest", methods=["POST"])
@jwt_required()
def ingest():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brain_id = request.form.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    files = request.files.getlist("files[]") or request.files.getlist("files")
    if not files:
        return jsonify({"error": "at least one file required"}), 400

    try:
        from app.services.ingestion_pipeline import ingest_documents
        result = ingest_documents(brain_id, user.id, files)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# POST /brain/ocr
# Multipart: brain_id (form), file (image or PDF of handwritten notes)
# Returns: { "markdown": "...", "preview_url": "..." } for split-view display
# Optionally stores as node after client confirms (or call generate-nodes with markdown)
# ---------------------------------------------------------------------------
@bp.route("/brain/ocr", methods=["POST"])
@jwt_required()
def ocr():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brain_id = request.form.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "file required"}), 400

    try:
        from app.services.ocr_service import run_ocr_to_markdown
        result = run_ocr_to_markdown(file)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# POST /brain/generate-nodes
# Body: JSON { "brain_id": "...", "chunks": [ { "text", "section_title?", "source_file_id?" } ] }
# Or for OCR result: { "brain_id": "...", "markdown": "...", "source_file_id?" }
# Generates nodes via OpenAI, stores embeddings in Pinecone, metadata in Postgres.
# ---------------------------------------------------------------------------
@bp.route("/brain/generate-nodes", methods=["POST"])
@jwt_required()
def generate_nodes():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    data = request.get_json() or {}
    brain_id = data.get("brain_id")
    if not brain_id:
        return jsonify({"error": "brain_id required"}), 400

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    chunks = data.get("chunks")
    markdown = data.get("markdown")
    source_file_id = data.get("source_file_id")

    if not chunks and not markdown:
        return jsonify({"error": "chunks or markdown required"}), 400

    try:
        from app.services.node_generation import generate_and_store_nodes
        result = generate_and_store_nodes(
            brain_id=brain_id,
            user_id=user.id,
            chunks=chunks,
            markdown=markdown,
            source_file_id=source_file_id,
        )
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /brain/list — list brains for current user (for sidebar)
# ---------------------------------------------------------------------------
@bp.route("/brain/list", methods=["GET"])
@jwt_required()
def list_brains():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brains = Brain.query.filter_by(user_id=user.id).order_by(Brain.created_at.desc()).all()
    return jsonify({
        "brains": [
            {
                "id": b.id,
                "name": b.name,
                "badge": b.badge,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in brains
        ]
    }), 200


# ---------------------------------------------------------------------------
# GET /brain/search?q=... — search nodes across all user's brains (title, summary, raw_content)
# ---------------------------------------------------------------------------
@bp.route("/brain/search", methods=["GET"])
@jwt_required()
def search():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"results": []}), 200

    search_term = f"%{q}%"
    brains = Brain.query.filter_by(user_id=user.id).all()
    brain_ids = [b.id for b in brains]
    if not brain_ids:
        return jsonify({"results": []}), 200

    from sqlalchemy import or_
    nodes = (
        Node.query.filter(Node.brain_id.in_(brain_ids))
        .filter(
            or_(
                Node.title.ilike(search_term),
                Node.summary.ilike(search_term),
                Node.raw_content.ilike(search_term),
            )
        )
        .limit(50)
        .all()
    )
    brain_map = {b.id: b.name for b in brains}
    return jsonify({
        "results": [
            {
                "id": n.id,
                "title": n.title,
                "summary": (n.summary or "")[:300],
                "brain_id": n.brain_id,
                "brain_name": brain_map.get(n.brain_id, ""),
            }
            for n in nodes
        ]
    }), 200


# ---------------------------------------------------------------------------
# GET /brain/<brain_id>/nodes — list nodes (paginated, search, sort, tag filter)
# Query: page=1, per_page=50, q=search, sort=recent|alpha, tag=foo
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/nodes", methods=["GET"])
@jwt_required()
def get_brain_nodes(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    from sqlalchemy import or_
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 50))))
    q = (request.args.get("q") or "").strip()
    tag = (request.args.get("tag") or "").strip()
    sort = (request.args.get("sort") or "recent").lower()

    query = Node.query.filter_by(brain_id=brain_id)
    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(
                Node.title.ilike(term),
                Node.markdown_content.ilike(term),
                Node.raw_content.ilike(term),
            )
        )
    if tag:
        query = query.filter(Node.tags.contains([tag]))
    if sort == "alpha":
        query = query.order_by(Node.title.asc())
    else:
        query = query.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())

    pagination = query.paginate(page=page, per_page=per_page)
    nodes = pagination.items
    return jsonify({
        "nodes": [
            _node_to_json(n)
            for n in nodes
        ],
        "total": pagination.total,
        "page": page,
        "per_page": per_page,
    }), 200


# ---------------------------------------------------------------------------
# POST /brain/<brain_id>/nodes — create a new node (note)
# Body: { "title": "Untitled", "markdown_content": "...", "tags": [], "node_type": "note" }
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/nodes", methods=["POST"])
@jwt_required()
def create_node(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    data = request.get_json() or {}
    title = (data.get("title") or "Untitled").strip()[:512] or "Untitled"
    markdown_content = data.get("markdown_content")
    if markdown_content is None:
        markdown_content = "# Untitled\n\nStart writing here. Use the sidebar to open other notes and the **Graph** to see connections."
    tags = data.get("tags")
    if not isinstance(tags, list):
        tags = []
    node_type = (data.get("node_type") or "note").strip() or "note"

    node_id = str(uuid.uuid4())
    node = Node(
        id=node_id,
        brain_id=brain_id,
        title=title,
        markdown_content=markdown_content,
        tags=[str(t).strip() for t in tags if t],
        node_type=node_type,
    )
    db.session.add(node)
    db.session.commit()
    return jsonify(_node_to_json(node)), 201


def _node_to_json(n):
    content = n.markdown_content if n.markdown_content is not None else n.raw_content
    return {
        "id": n.id,
        "brain_id": n.brain_id,
        "title": n.title,
        "markdown_content": content or "",
        "tags": n.tags if n.tags is not None else (n.concepts or []),
        "node_type": getattr(n, "node_type", None) or "note",
        "summary": n.summary,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        "related_node_ids": n.related_node_ids or [],
    }


def _node_for_user(node_id, user_id):
    node = Node.query.get(node_id)
    if not node:
        return None
    brain = _brain_for_user(node.brain_id, user_id)
    return node if brain else None


# ---------------------------------------------------------------------------
# GET /nodes/<node_id> — single node
# ---------------------------------------------------------------------------
@bp.route("/nodes/<node_id>", methods=["GET"])
@jwt_required()
def get_node(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404
    return jsonify(_node_to_json(node)), 200


# ---------------------------------------------------------------------------
# PUT /nodes/<node_id> — update title, markdown_content, tags
# ---------------------------------------------------------------------------
@bp.route("/nodes/<node_id>", methods=["PUT"])
@jwt_required()
def update_node(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404

    data = request.get_json() or {}
    if "title" in data and data["title"] is not None:
        node.title = (data["title"] or "").strip()[:512] or node.title
    if "markdown_content" in data:
        node.markdown_content = data["markdown_content"] if data["markdown_content"] is not None else None
    if "tags" in data and isinstance(data["tags"], list):
        node.tags = [str(t).strip() for t in data["tags"] if t]
    try:
        node.updated_at = datetime.now(timezone.utc)
    except Exception:
        pass
    db.session.commit()
    return jsonify(_node_to_json(node)), 200


# ---------------------------------------------------------------------------
# GET /nodes/<node_id>/backlinks — nodes that link TO this node (reverse edges)
# ---------------------------------------------------------------------------
@bp.route("/nodes/<node_id>/backlinks", methods=["GET"])
@jwt_required()
def get_backlinks(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404

    backlink_edges = NodeRelationship.query.filter_by(target_node_id=node_id).all()
    source_ids = list({e.source_node_id for e in backlink_edges})
    nodes = Node.query.filter(Node.id.in_(source_ids)).all() if source_ids else []
    node_map = {n.id: n for n in nodes}
    return jsonify({
        "backlinks": [
            {"id": nid, "title": node_map[nid].title, "tags": node_map[nid].tags or []}
            for nid in source_ids if nid in node_map
        ]
    }), 200


# ---------------------------------------------------------------------------
# GET /nodes/<node_id>/related — graph neighbors + optional Pinecone semantic neighbors
# ---------------------------------------------------------------------------
@bp.route("/nodes/<node_id>/related", methods=["GET"])
@jwt_required()
def get_related(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404

    out_edges = NodeRelationship.query.filter_by(source_node_id=node_id).all()
    in_edges = NodeRelationship.query.filter_by(target_node_id=node_id).all()
    neighbor_ids = set()
    for e in out_edges:
        neighbor_ids.add(e.target_node_id)
    for e in in_edges:
        neighbor_ids.add(e.source_node_id)
    neighbor_ids.discard(node_id)

    related = []
    if neighbor_ids:
        neighbors = Node.query.filter(Node.id.in_(list(neighbor_ids))).all()
        for n in neighbors:
            related.append({"id": n.id, "title": n.title, "tags": n.tags or []})

    related_node_ids = set(node.related_node_ids or [])
    related_node_ids.discard(node_id)
    for nid in related_node_ids:
        if nid in [r["id"] for r in related]:
            continue
        n = Node.query.get(nid)
        if n:
            related.append({"id": n.id, "title": n.title, "tags": n.tags or []})

    try:
        from app.services.pinecone_service import similarity_search
        from app.services.openai_service import get_embedding
        if node.embedding_id:
            emb = get_embedding((node.title or "") + "\n" + (node.markdown_content or node.raw_content or "")[:2000])
            similar = similarity_search(node.brain_id, emb, top_k=5, threshold=0.7, exclude_ids=[node_id])
            for s in similar:
                n = Node.query.get(s["id"])
                if n and not any(r["id"] == n.id for r in related):
                    related.append({"id": n.id, "title": n.title, "tags": n.tags or [], "source": "semantic"})
    except Exception:
        pass

    return jsonify({"related": related}), 200


# ---------------------------------------------------------------------------
# GET /brain/<brain_id>/graph — nodes + edges for graph view (one shot, cache on client)
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/graph", methods=["GET"])
@jwt_required()
def get_brain_graph(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    nodes = Node.query.filter_by(brain_id=brain_id).all()
    node_ids = {n.id for n in nodes}
    edges = NodeRelationship.query.filter(
        NodeRelationship.source_node_id.in_(node_ids),
        NodeRelationship.target_node_id.in_(node_ids),
    ).all()

    node_list = [_node_to_json(n) for n in nodes]
    edge_list = [
        {
            "source": e.source_node_id,
            "target": e.target_node_id,
            "type": e.edge_type or "related",
            "weight": e.weight if e.weight is not None else e.similarity_score,
        }
        for e in edges
    ]
    for n in nodes:
        for target_id in (n.related_node_ids or []):
            if not any(ed["source"] == n.id and ed["target"] == target_id for ed in edge_list):
                edge_list.append({"source": n.id, "target": target_id, "type": "related", "weight": None})

    return jsonify({"nodes": node_list, "edges": edge_list}), 200


# ---------------------------------------------------------------------------
# GET /graph/global — nodes + edges from ALL user brains (for Global Graph mode)
# ---------------------------------------------------------------------------
@bp.route("/graph/global", methods=["GET"])
@jwt_required()
def get_global_graph():
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404

    brains = Brain.query.filter_by(user_id=user.id).all()
    brain_ids = [b.id for b in brains]
    if not brain_ids:
        return jsonify({"nodes": [], "edges": []}), 200

    nodes = Node.query.filter(Node.brain_id.in_(brain_ids)).all()
    node_ids = {n.id for n in nodes}
    edges = NodeRelationship.query.filter(
        NodeRelationship.source_node_id.in_(node_ids),
        NodeRelationship.target_node_id.in_(node_ids),
    ).all()

    node_list = [_node_to_json(n) for n in nodes]
    edge_list = [
        {"source": e.source_node_id, "target": e.target_node_id, "type": e.edge_type or "related", "weight": e.weight or e.similarity_score}
        for e in edges
    ]
    for n in nodes:
        for target_id in (n.related_node_ids or []):
            if target_id in node_ids and not any(ed["source"] == n.id and ed["target"] == target_id for ed in edge_list):
                edge_list.append({"source": n.id, "target": target_id, "type": "related", "weight": None})

    return jsonify({"nodes": node_list, "edges": edge_list}), 200
