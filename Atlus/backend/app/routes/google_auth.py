from flask import Blueprint, request, jsonify

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from flask_jwt_extended import create_access_token, create_refresh_token

from app.config import Config
from app.extensions import db
from app.models.user import User

bp = Blueprint("google_auth", __name__)


@bp.route("/google", methods=["POST"])
def google():
    data = request.get_json() or {}
    credential = data.get("credential") or ""

    if not credential:
        return jsonify({"error": "credential required"}), 400

    client_id = Config.GOOGLE_CLIENT_ID
    if not client_id:
        return jsonify({"error": "Google auth not configured"}), 500

    try:
        idinfo = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            client_id,
        )
    except ValueError:
        return jsonify({"error": "invalid Google token"}), 401

    email = (idinfo.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "no email in token"}), 401

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(email=email, password_hash=None, role="user")
        db.session.add(user)
        db.session.commit()

    # Keep JWT subject as string for broad compatibility with JWT validators.
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    return jsonify({"access_token": access_token, "refresh_token": refresh_token})
