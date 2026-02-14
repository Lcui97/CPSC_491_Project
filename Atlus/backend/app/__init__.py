from flask import Flask, jsonify
from app.config import Config
from app.extensions import cors, db, jwt


def _jwt_error_response(message, status=401):
    """Return JSON error for JWT failures so frontend can show a clear message."""
    return jsonify({"error": message}), status


def _apply_sqlite_compat_migrations(app):
    """
    Keep local SQLite schema compatible with evolving models.
    create_all() creates missing tables but does not add new columns to existing tables.
    """
    uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if not str(uri).startswith("sqlite"):
        return

    desired = {
        "brains": {
            "seed_nodes_created": "BOOLEAN NOT NULL DEFAULT 0",
        },
        "nodes": {
            "markdown_content": "TEXT",
            "tags": "JSON",
            "node_type": "VARCHAR(32)",
            "updated_at": "DATETIME",
        },
        "node_relationships": {
            "edge_type": "VARCHAR(64)",
            "weight": "FLOAT",
        },
    }

    with db.engine.begin() as conn:
        for table, cols in desired.items():
            existing = {
                row[1]
                for row in conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            }
            for col_name, col_def in cols.items():
                if col_name in existing:
                    continue
                conn.exec_driver_sql(
                    f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"
                )


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    jwt.init_app(app)

    @jwt.expired_token_loader
    def expired_callback(jwt_header, jwt_payload):
        return _jwt_error_response("Session expired. Please log in again.")

    @jwt.invalid_token_loader
    def invalid_callback(error_string):
        return _jwt_error_response("Invalid or expired token. Please log in again.")

    @jwt.unauthorized_loader
    def missing_callback(error_string):
        return _jwt_error_response("Please log in to continue.")

    cors.init_app(
        app,
        origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=True,
    )

    from app.routes import auth, home, google_auth, brain
    app.register_blueprint(auth.bp, url_prefix="/api")
    app.register_blueprint(home.bp, url_prefix="/api")
    app.register_blueprint(google_auth.bp, url_prefix="/api/auth")
    app.register_blueprint(brain.bp, url_prefix="/api")

    with app.app_context():
        try:
            db.create_all()
            _apply_sqlite_compat_migrations(app)
        except Exception as e:
            if "already exists" not in str(e).lower():
                raise

    return app
