from flask import Flask
from app.config import Config
from app.extensions import cors, db, jwt


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(
        app,
        origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=True,
    )

    from app.routes import auth, home, google_auth
    app.register_blueprint(auth.bp, url_prefix="/api")
    app.register_blueprint(home.bp, url_prefix="/api")
    app.register_blueprint(google_auth.bp, url_prefix="/api/auth")

    with app.app_context():
        db.create_all()

    return app
