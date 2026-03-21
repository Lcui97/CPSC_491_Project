import os
from pathlib import Path

from dotenv import load_dotenv

# Always load backend/.env (not cwd), and override machine env vars so local .env wins.
# Stale OPENAI_API_KEY in Windows "User environment variables" is a common cause of 401s.
_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env", override=True)


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", os.environ.get("SECRET_KEY", "change-me"))
    # Access token: 24 hours default so login stays valid. Set JWT_ACCESS_TOKEN_EXPIRES in .env to override.
    JWT_ACCESS_TOKEN_EXPIRES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 60 * 60 * 24))
    JWT_REFRESH_TOKEN_EXPIRES = int(os.environ.get("JWT_REFRESH_TOKEN_EXPIRES", 60 * 60 * 24 * 7))
    SQLALCHEMY_DATABASE_URI = os.environ.get("SQLALCHEMY_DATABASE_URI", "sqlite:///app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    # Handwritten scans: saved under backend/<UPLOAD_FOLDER>/<brain_id>/
    UPLOAD_FOLDER = os.environ.get("ATLUS_UPLOAD_FOLDER", "uploads")
