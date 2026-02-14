from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import User
from app.models.brain import Brain, Node

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
    brains = Brain.query.filter_by(user_id=user.id).all()
    brains_count = len(brains)
    brain_ids = [b.id for b in brains]
    if brain_ids:
        from sqlalchemy import or_
        # Count note, handwritten, textbook_section; include NULL (legacy) as note
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
