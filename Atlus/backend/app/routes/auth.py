from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    get_jwt,
)

from app.extensions import db
from app.models.user import User
from app.utils.security import check_password, hash_password

bp = Blueprint("auth", __name__)


@bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return {"error": "email and password required"}, 400

    if User.query.filter_by(email=email).first():
        return {"error": "email already registered"}, 409

    user = User(email=email, password_hash=hash_password(password), role="user")
    db.session.add(user)
    db.session.commit()
    return {"message": "created"}, 201


@bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return {"error": "email and password required"}, 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not check_password(password, user.password_hash):
        return {"error": "invalid credentials"}, 401

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    return {"access_token": access_token, "refresh_token": refresh_token}


@bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Exchange a valid refresh token for a new access token. Call with Authorization: Bearer <refresh_token>."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return {"error": "user not found"}, 404
    access_token = create_access_token(identity=user.id)
    return {"access_token": access_token}


@bp.route("/logout", methods=["POST"])
@jwt_required(optional=True)
def logout():
    """Client should clear access_token and refresh_token from storage after calling this."""
    # Optional: add refresh token to a blacklist here if you store them server-side
    return {"message": "ok"}, 200
