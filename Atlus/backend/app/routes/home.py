from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import User
from sqlalchemy import or_

from app.models.brain import Brain, BrainCollaborator, Node

bp = Blueprint("home", __name__)

# Node types counted as "notes" for account stats (exclude seed/system)
NOTE_TYPES = ("note", "handwritten", "textbook_section")


@bp.route("/home", methods=["GET"])
@jwt_required()
def home():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    return jsonify({"message": f"Welcome {user.email}"})


@bp.route("/me/summary", methods=["GET"])
@jwt_required()
def me_summary():
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404
    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r.brain_id for r in BrainCollaborator.query.filter_by(user_id=user.id).all()]
    brain_ids = list({*(b.id for b in owned), *collab_ids})
    brains_count = len(brain_ids)
    if brain_ids:
        total_notes = Node.query.filter(
            Node.brain_id.in_(brain_ids),
            or_(Node.node_type.in_(NOTE_TYPES), Node.node_type.is_(None)),
        ).count()
    else:
        total_notes = 0
    return jsonify({
        "email": user.email,
        "total_notes": total_notes,
        "brains_count": brains_count,
    }), 200


@bp.route("/me/activity", methods=["GET"])
@jwt_required()
def me_activity():
    """Recent notes across all of the user's brains (for dashboard activity feed)."""
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    limit = min(20, max(1, int(request.args.get("limit", 8))))
    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r.brain_id for r in BrainCollaborator.query.filter_by(user_id=user.id).all()]
    collab_brains = Brain.query.filter(Brain.id.in_(collab_ids)).all() if collab_ids else []
    brain_map = {b.id: b.name for b in owned}
    for b in collab_brains:
        brain_map.setdefault(b.id, b.name)
    if not brain_map:
        return jsonify({"items": []}), 200

    accessible_ids = list(brain_map.keys())
    q = (
        Node.query.filter(Node.brain_id.in_(accessible_ids))
        .filter(or_(Node.node_type.in_(NOTE_TYPES), Node.node_type.is_(None)))
    )
    rows = (
        q.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())
        .limit(limit)
        .all()
    )
    items = []
    for n in rows:
        items.append({
            "id": n.id,
            "title": n.title or "Untitled",
            "brain_id": n.brain_id,
            "brain_name": brain_map.get(n.brain_id, ""),
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "kind": "note",
        })
    return jsonify({"items": items}), 200


@bp.route("/me/notes", methods=["GET"])
@jwt_required()
def me_notes():
    """Paginated notes across all of the user's brains (gallery / global list)."""
    user_id = get_jwt_identity()
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        pass
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "user not found"}), 404

    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 48))))
    q = (request.args.get("q") or "").strip()

    owned = Brain.query.filter_by(user_id=user.id).all()
    collab_ids = [r.brain_id for r in BrainCollaborator.query.filter_by(user_id=user.id).all()]
    collab_brains = Brain.query.filter(Brain.id.in_(collab_ids)).all() if collab_ids else []

    brain_map = {b.id: b.name for b in owned}
    for b in collab_brains:
        brain_map.setdefault(b.id, b.name)

    if not brain_map:
        return jsonify({"nodes": [], "total": 0, "page": page, "per_page": per_page}), 200

    accessible_ids = list(brain_map.keys())

    base = (
        Node.query.filter(Node.brain_id.in_(accessible_ids))
        .filter(or_(Node.node_type.in_(NOTE_TYPES), Node.node_type.is_(None)))
    )
    if q:
        like = f"%{q}%"
        base = base.filter(or_(Node.title.ilike(like), Node.markdown_content.ilike(like)))

    total = base.count()
    rows = (
        base.order_by(Node.updated_at.desc().nullslast(), Node.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    nodes_out = []
    for n in rows:
        nodes_out.append({
            "id": n.id,
            "brain_id": n.brain_id,
            "brain_name": brain_map.get(n.brain_id, ""),
            "title": n.title or "Untitled",
            "summary": (n.summary or "")[:400],
            "markdown_content": (n.markdown_content or "")[:500],
            "node_type": n.node_type or "note",
            "source_file_id": n.source_file_id,
            "tags": n.tags or [],
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    return jsonify({
        "nodes": nodes_out,
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }), 200
