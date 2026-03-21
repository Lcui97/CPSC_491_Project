"""
Brain API: create, ingest documents, OCR, generate nodes.
- POST /brain/create — create Brain (optional initial documents in same request).
- POST /brain/ingest — ingest PDF/text/markdown into existing Brain (textbook pipeline).
- POST /brain/ocr — OCR image(s) and return structured markdown (handwritten notes pipeline).
- POST /brain/generate-nodes — from text/chunks, generate nodes + embeddings + store.
"""
import os
import uuid
import threading
from collections import defaultdict
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from werkzeug.datastructures import FileStorage

from app.extensions import db
from app.models.brain import (
    Brain,
    BrainCollaborator,
    BrainShareLink,
    Node,
    NodeRelationship,
    SourceFile,
)
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
    """Brain the user owns or has joined via a share link."""
    brain = Brain.query.filter_by(id=brain_id).first()
    if not brain:
        return None
    if brain.user_id == user_id:
        return brain
    if BrainCollaborator.query.filter_by(brain_id=brain_id, user_id=user_id).first():
        return brain
    return None


def _upload_root():
    return Path(current_app.root_path).parent / current_app.config.get("UPLOAD_FOLDER", "uploads")


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

    # If files were provided, run ingestion in background so the request returns immediately.
    # Read file data now (before response); request stream is invalid after we return.
    if files:
        import io
        file_payloads = []
        for f in files:
            if not f or not getattr(f, "filename", None):
                continue
            try:
                data = f.read()
                if not data:
                    continue
                # Wrapper so ingestion_pipeline can use .filename and .stream
                obj = type("FileLike", (), {"filename": f.filename, "stream": io.BytesIO(data)})()
                obj.read = lambda d=data: d  # bound copy per file
                file_payloads.append(obj)
            except Exception:
                continue
        if file_payloads:
            brain_id_copy = brain_id
            user_id_copy = user.id
            uri = (current_app.config.get("SQLALCHEMY_DATABASE_URI") or "").lower()
            if "sqlite" in uri:
                # SQLite uses file-level locking; a background thread can cause "database is locked"
                # Run ingestion in foreground so only one writer at a time.
                try:
                    from app.services.ingestion_pipeline import process_creation_files
                    process_creation_files(brain_id_copy, user_id_copy, file_payloads)
                except Exception:
                    db.session.rollback()
            else:
                app = current_app._get_current_object()

                def ingest_in_background():
                    with app.app_context():
                        try:
                            from app.services.ingestion_pipeline import process_creation_files
                            process_creation_files(brain_id_copy, user_id_copy, file_payloads)
                        except Exception:
                            pass

                threading.Thread(target=ingest_in_background, daemon=True).start()

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
# Returns immediately; runs extraction + OpenAI + Pinecone in background (can take minutes for large PDFs)
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

    # Read file data before response (request stream invalid after return)
    import io
    file_payloads = []
    for f in files:
        if not f or not getattr(f, "filename", None):
            continue
        try:
            data = f.read()
            if not data:
                continue
            obj = type("FileLike", (), {"filename": f.filename, "stream": io.BytesIO(data)})()
            obj.read = lambda d=data: d
            file_payloads.append(obj)
        except Exception:
            continue

    if not file_payloads:
        return jsonify({"error": "no valid files to process"}), 400

    brain_id_copy = brain_id
    user_id_copy = user.id
    app = current_app._get_current_object()

    def ingest_in_background():
        with app.app_context():
            try:
                from app.services.ingestion_pipeline import ingest_documents
                ingest_documents(brain_id_copy, user_id_copy, file_payloads)
            except Exception:
                db.session.rollback()

    threading.Thread(target=ingest_in_background, daemon=True).start()

    return jsonify({
        "message": "Processing started. Your document will appear in Sources when ready (may take a few minutes for large PDFs).",
        "processing": True,
        "files_count": len(file_payloads),
    }), 200


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
        data = file.read()
        if not data:
            return jsonify({"error": "empty file"}), 400

        ext = os.path.splitext((file.filename or "").lower())[-1]
        allowed_img = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
        is_pdf = ext == ".pdf"
        source_file_id = None

        if not is_pdf and ext in allowed_img:
            upload_root = _upload_root()
            brain_dir = upload_root / brain_id
            brain_dir.mkdir(parents=True, exist_ok=True)
            uid = str(uuid.uuid4())
            fname = f"{uid}{ext}"
            full_path = brain_dir / fname
            full_path.write_bytes(data)
            rel = f"{brain_id}/{fname}"
            sf = SourceFile(
                brain_id=brain_id,
                filename=file.filename or "scan.png",
                file_type="image",
                storage_path=rel,
            )
            db.session.add(sf)
            db.session.commit()
            source_file_id = sf.id

        bio = BytesIO(data)
        bio.seek(0)
        fs = FileStorage(stream=bio, filename=file.filename or "upload.png")
        from app.services.ocr_service import run_ocr_to_markdown

        result = run_ocr_to_markdown(fs)
        result["source_file_id"] = source_file_id
        if source_file_id:
            result["preview_path"] = f"/api/brain/{brain_id}/sources/{source_file_id}/file"
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /brain/<brain_id>/sources/<source_id>/file — serve uploaded scan (auth)
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/sources/<int:source_id>/file", methods=["GET"])
@jwt_required()
def serve_source_file(brain_id, source_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    src = SourceFile.query.filter_by(id=source_id, brain_id=brain_id).first()
    if not src or not src.storage_path:
        return jsonify({"error": "file not found"}), 404
    path = _upload_root() / src.storage_path
    if not path.is_file():
        return jsonify({"error": "file missing on disk"}), 404
    return send_file(path, as_attachment=False, download_name=src.filename or "scan.png")


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
    node_type = (data.get("node_type") or "").strip() or None

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
            node_type=node_type,
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

    owned = Brain.query.filter_by(user_id=user.id).order_by(Brain.created_at.desc()).all()
    collab_ids = [
        r[0]
        for r in db.session.query(BrainCollaborator.brain_id)
        .filter(BrainCollaborator.user_id == user.id)
        .all()
    ]
    collab_brains = []
    if collab_ids:
        collab_brains = (
            Brain.query.filter(Brain.id.in_(collab_ids))
            .order_by(Brain.created_at.desc())
            .all()
        )
    seen = set()
    merged = []
    for b in owned:
        if b.id not in seen:
            seen.add(b.id)
            merged.append(b)
    for b in collab_brains:
        if b.id not in seen:
            seen.add(b.id)
            merged.append(b)

    return jsonify({
        "brains": [
            {
                "id": b.id,
                "name": b.name,
                "badge": b.badge,
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "is_owner": b.user_id == user.id,
            }
            for b in merged
        ]
    }), 200


# ---------------------------------------------------------------------------
# POST /brain/<brain_id>/leave — collaborator removes self (owner cannot "leave")
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/leave", methods=["POST"])
@jwt_required()
def leave_brain(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = Brain.query.filter_by(id=brain_id).first()
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    if brain.user_id == user.id:
        return jsonify({"error": "owners should delete the brain instead of leaving"}), 400
    row = BrainCollaborator.query.filter_by(brain_id=brain_id, user_id=user.id).first()
    if not row:
        return jsonify({"error": "not a collaborator on this brain"}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({"ok": True}), 200


# ---------------------------------------------------------------------------
# DELETE /brain/<brain_id> — owner only; removes nodes, sources, uploads, Pinecone namespace
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>", methods=["DELETE"])
@jwt_required()
def delete_brain(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = Brain.query.filter_by(id=brain_id).first()
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    if brain.user_id != user.id:
        return jsonify({"error": "only the brain owner can delete it"}), 403

    from sqlalchemy import or_

    node_ids = [n.id for n in Node.query.filter_by(brain_id=brain_id).all()]
    if node_ids:
        NodeRelationship.query.filter(
            or_(
                NodeRelationship.source_node_id.in_(node_ids),
                NodeRelationship.target_node_id.in_(node_ids),
            )
        ).delete(synchronize_session=False)
    Node.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)

    upload_root = _upload_root()
    for sf in SourceFile.query.filter_by(brain_id=brain_id).all():
        if sf.storage_path:
            fp = upload_root / sf.storage_path
            if fp.is_file():
                try:
                    fp.unlink()
                except OSError:
                    pass
    SourceFile.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)

    brain_dir = upload_root / brain_id
    if brain_dir.is_dir():
        import shutil

        try:
            shutil.rmtree(brain_dir, ignore_errors=True)
        except Exception:
            pass

    BrainShareLink.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)
    BrainCollaborator.query.filter_by(brain_id=brain_id).delete(synchronize_session=False)

    try:
        from app.services.pinecone_service import delete_brain_namespace

        delete_brain_namespace(brain_id)
    except Exception:
        pass

    db.session.delete(brain)
    db.session.commit()
    return jsonify({"ok": True, "id": brain_id}), 200


# ---------------------------------------------------------------------------
# POST /brain/<brain_id>/share-link — owner creates invite token
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/share-link", methods=["POST"])
@jwt_required()
def create_brain_share_link(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = Brain.query.filter_by(id=brain_id, user_id=user.id).first()
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    token = str(uuid.uuid4())
    link = BrainShareLink(token=token, brain_id=brain_id, created_by_user_id=user.id)
    db.session.add(link)
    db.session.commit()
    return jsonify({"token": token, "share_path": f"/shared/{token}"}), 201


# ---------------------------------------------------------------------------
# GET /share/brain/<token> — public metadata for landing page (no auth)
# ---------------------------------------------------------------------------
@bp.route("/share/brain/<token>", methods=["GET"])
def public_share_brain_info(token):
    link = BrainShareLink.query.filter_by(token=token).first()
    if not link:
        return jsonify({"error": "not found"}), 404
    brain = Brain.query.get(link.brain_id)
    if not brain:
        return jsonify({"error": "not found"}), 404
    return jsonify({
        "brain": {
            "id": brain.id,
            "name": brain.name,
            "badge": brain.badge,
        }
    }), 200


# ---------------------------------------------------------------------------
# POST /share/brain/<token>/join — logged-in user joins as collaborator
# ---------------------------------------------------------------------------
@bp.route("/share/brain/<token>/join", methods=["POST"])
@jwt_required()
def join_shared_brain(token):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    link = BrainShareLink.query.filter_by(token=token).first()
    if not link:
        return jsonify({"error": "not found"}), 404
    brain = Brain.query.get(link.brain_id)
    if not brain:
        return jsonify({"error": "not found"}), 404
    if brain.user_id == user.id:
        return jsonify({"ok": True, "brain_id": brain.id, "role": "owner"}), 200
    if BrainCollaborator.query.filter_by(brain_id=brain.id, user_id=user.id).first():
        return jsonify({"ok": True, "brain_id": brain.id, "role": "collaborator"}), 200
    db.session.add(BrainCollaborator(brain_id=brain.id, user_id=user.id))
    db.session.commit()
    return jsonify({"ok": True, "brain_id": brain.id, "role": "collaborator"}), 200


# ---------------------------------------------------------------------------
# GET /brain/<brain_id>/sources — list source files (uploaded docs) for a brain
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/sources", methods=["GET"])
@jwt_required()
def get_brain_sources(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    sources = SourceFile.query.filter_by(brain_id=brain_id).order_by(SourceFile.created_at.desc()).all()
    return jsonify({
        "sources": [
            {
                "id": s.id,
                "filename": s.filename,
                "file_type": s.file_type,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "has_file": bool(s.storage_path),
            }
            for s in sources
        ]
    }), 200


# ---------------------------------------------------------------------------
# DELETE /brain/<brain_id>/sources/<source_id> — remove source record; detach nodes (keeps notes)
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/sources/<int:source_id>", methods=["DELETE"])
@jwt_required()
def delete_brain_source(brain_id, source_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404
    src = SourceFile.query.filter_by(id=source_id, brain_id=brain_id).first()
    if not src:
        return jsonify({"error": "source not found"}), 404
    Node.query.filter(Node.brain_id == brain_id, Node.source_file_id == source_id).update(
        {Node.source_file_id: None},
        synchronize_session=False,
    )
    db.session.delete(src)
    db.session.commit()
    return jsonify({"ok": True}), 200


# ---------------------------------------------------------------------------
# POST /brain/<brain_id>/ask — prompt LLM with brain context (summarize, study guide, etc.)
# Body: { "prompt": "...", "mode": "summary" | "study_guide" | "key_points" | "custom" }
# ---------------------------------------------------------------------------
@bp.route("/brain/<brain_id>/ask", methods=["POST"])
@jwt_required()
def ask_brain_route(brain_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    brain = _brain_for_user(brain_id, user.id)
    if not brain:
        return jsonify({"error": "brain not found"}), 404

    data = request.get_json() or {}
    prompt = (data.get("prompt") or "").strip()
    mode = (data.get("mode") or "summary").strip().lower()
    if mode not in ("summary", "study_guide", "key_points", "custom"):
        mode = "custom"

    nodes = Node.query.filter_by(brain_id=brain_id).order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc()).limit(100).all()
    context_parts = []
    for n in nodes:
        content = n.markdown_content or n.raw_content or ""
        if content.strip():
            title = (n.title or "Untitled").strip()
            context_parts.append(f"## {title}\n\n{content[:8000]}")
    context_text = "\n\n---\n\n".join(context_parts) if context_parts else ""

    if not context_text.strip():
        return jsonify({"response": "Add some notes or upload documents to this brain first, then ask for a summary or study guide."}), 200

    try:
        from app.services.openai_service import ask_brain as llm_ask_brain
        response_text = llm_ask_brain(context_text, prompt or "Summarize the above.", mode)
        return jsonify({"response": response_text}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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
        markdown_content = "# Untitled\n\nStart writing here. Handwritten scans open with the image on the left and Markdown on the right."
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
        "source_file_id": getattr(n, "source_file_id", None),
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
    try:
        from app.services.node_generation import relink_user_note

        relink_user_note(node_id, node.brain_id)
    except Exception:
        pass
    db.session.refresh(node)
    return jsonify(_node_to_json(node)), 200


# ---------------------------------------------------------------------------
# DELETE /nodes/<node_id> — delete note and clean up edges / vectors
# ---------------------------------------------------------------------------
@bp.route("/nodes/<node_id>", methods=["DELETE"])
@jwt_required()
def delete_node(node_id):
    user = _get_user_or_404()
    if not user:
        return jsonify({"error": "user not found"}), 404
    node = _node_for_user(node_id, user.id)
    if not node:
        return jsonify({"error": "node not found"}), 404

    brain_id = node.brain_id

    NodeRelationship.query.filter(
        (NodeRelationship.source_node_id == node_id) | (NodeRelationship.target_node_id == node_id)
    ).delete(synchronize_session=False)

    others = Node.query.filter_by(brain_id=brain_id).all()
    for n in others:
        rel = n.related_node_ids or []
        if node_id in rel:
            n.related_node_ids = [x for x in rel if x != node_id]

    try:
        from app.services.pinecone_service import delete_vectors

        vid = node.embedding_id or node.id
        delete_vectors(brain_id, [str(vid)])
    except Exception:
        pass

    db.session.delete(node)
    db.session.commit()
    return jsonify({"ok": True, "id": node_id, "brain_id": brain_id}), 200


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
            related.append({
                "id": n.id,
                "title": n.title,
                "tags": n.tags or [],
                "similarity": 0.86,
                "source": "graph",
            })

    related_node_ids = set(node.related_node_ids or [])
    related_node_ids.discard(node_id)
    for nid in related_node_ids:
        if nid in [r["id"] for r in related]:
            continue
        n = Node.query.get(nid)
        if n:
            related.append({
                "id": n.id,
                "title": n.title,
                "tags": n.tags or [],
                "similarity": 0.78,
                "source": "similarity",
            })

    try:
        from app.services.pinecone_service import similarity_search
        from app.services.openai_service import get_embedding
        if node.embedding_id:
            emb = get_embedding((node.title or "") + "\n" + (node.markdown_content or node.raw_content or "")[:2000])
            similar = similarity_search(node.brain_id, emb, top_k=5, threshold=0.7, exclude_ids=[node_id])
            for s in similar:
                n = Node.query.get(s["id"])
                if n and not any(r["id"] == n.id for r in related):
                    sc = float(s.get("score") or 0)
                    related.append({
                        "id": n.id,
                        "title": n.title,
                        "tags": n.tags or [],
                        "similarity": sc,
                        "source": "semantic",
                    })
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

    brains = Brain.query.filter_by(user_id=user.id).order_by(Brain.created_at.desc()).all()
    brain_ids = [b.id for b in brains]
    if not brain_ids:
        return jsonify({"nodes": [], "edges": []}), 200

    brain_by_id = {b.id: b for b in brains}
    brain_names = {b.id: b.name for b in brains}

    nodes = Node.query.filter(Node.brain_id.in_(brain_ids)).all()
    node_list = []
    for n in nodes:
        j = _node_to_json(n)
        j["brain_name"] = brain_names.get(n.brain_id)
        node_list.append(j)

    edge_list = []
    if nodes:
        node_ids = {n.id for n in nodes}
        edges = NodeRelationship.query.filter(
            NodeRelationship.source_node_id.in_(node_ids),
            NodeRelationship.target_node_id.in_(node_ids),
        ).all()
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
                if target_id in node_ids and not any(
                    ed["source"] == n.id and ed["target"] == target_id for ed in edge_list
                ):
                    edge_list.append({"source": n.id, "target": target_id, "type": "related", "weight": None})

    # One hub node per brain: shows all workspaces and links brains that share tags
    tag_sets = defaultdict(set)
    for n in nodes:
        tags = n.tags if n.tags is not None else (n.concepts or [])
        for t in tags or []:
            if t:
                tag_sets[n.brain_id].add(str(t).strip().lower())

    for bid in brain_ids:
        b = brain_by_id[bid]
        node_list.append(
            {
                "id": f"__brain_{bid}",
                "brain_id": bid,
                "source_file_id": None,
                "title": b.name,
                "markdown_content": "",
                "tags": ["__brain_hub__"],
                "node_type": "brain_hub",
                "summary": f"Workspace · {b.badge}",
                "created_at": b.created_at.isoformat() if b.created_at else None,
                "updated_at": None,
                "related_node_ids": [],
                "brain_name": b.name,
            }
        )

    for i, bid_a in enumerate(brain_ids):
        for bid_b in brain_ids[i + 1 :]:
            shared = tag_sets[bid_a] & tag_sets[bid_b]
            if not shared:
                continue
            w = min(len(shared) / 5.0, 1.0) or 0.2
            edge_list.append(
                {
                    "source": f"__brain_{bid_a}",
                    "target": f"__brain_{bid_b}",
                    "type": "brain_link",
                    "weight": w,
                }
            )

    # Pull each note toward its brain hub (same layout idea as single-brain graph)
    if nodes and len(nodes) <= 400:
        for n in nodes:
            edge_list.append(
                {
                    "source": n.id,
                    "target": f"__brain_{n.brain_id}",
                    "type": "in_brain",
                    "weight": 0.25,
                }
            )

    return jsonify({"nodes": node_list, "edges": edge_list}), 200
