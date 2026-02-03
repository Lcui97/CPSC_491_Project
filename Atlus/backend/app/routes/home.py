from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import User

bp = Blueprint("home", __name__)


@bp.route("/home", methods=["GET"])
@jwt_required()
def home():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return {"error": "user not found"}, 404
    return {"message": f"Welcome {user.email}"}
