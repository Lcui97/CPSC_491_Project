from flask import Flask, jsonify
from app.config import Config
from app.extensions import cors, db, jwt


def _jwt_error_response(message, status=401):
    """JWT errors as JSON so the UI can show a friendly string."""
    return jsonify({"error": message}), status


def _apply_sqlite_compat_migrations(app):
    """SQLite-only: add columns we added to models after the DB already existed (create_all won't)."""
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
        "calendar_events": {
            "course_label": "VARCHAR(128)",
            "confidence": "FLOAT",
            "notes": "TEXT",
            "updated_at": "DATETIME",
        },
    }

    with db.engine.begin() as conn:
        conn.exec_driver_sql(
            """
            CREATE TABLE IF NOT EXISTS calendar_events (
                id INTEGER PRIMARY KEY,
                brain_id VARCHAR(64) NOT NULL,
                source_file_id INTEGER,
                title VARCHAR(512) NOT NULL,
                event_type VARCHAR(32) NOT NULL DEFAULT 'other',
                due_at DATETIME NOT NULL,
                course_label VARCHAR(128),
                confidence FLOAT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(brain_id) REFERENCES brains(id),
                FOREIGN KEY(source_file_id) REFERENCES source_files(id)
            )
            """
        )
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

    _dev_origins = []
    for host in ("localhost", "127.0.0.1"):
        for port in (5173, 5174, 5175, 4173):
            _dev_origins.append(f"http://{host}:{port}")
    cors.init_app(
        app,
        origins=_dev_origins,
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
            uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
            if "sqlite" in str(uri).lower():
                from sqlalchemy import event
                @event.listens_for(db.engine, "connect")
                def _set_sqlite_pragma(dbapi_conn, connection_record):
                    cursor = dbapi_conn.cursor()
                    cursor.execute("PRAGMA journal_mode=WAL")
                    cursor.execute("PRAGMA busy_timeout=30000")
                    cursor.close()
        except Exception as e:
            if "already exists" not in str(e).lower():
                raise

    return app
