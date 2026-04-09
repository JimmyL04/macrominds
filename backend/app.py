# Flask app entry point

import os
import re
import sys
import logging

from flask import Flask, jsonify, request, send_from_directory

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.routes.api import api_bp  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


def initialize_if_empty() -> dict:
    """Create schema and seed data if the DB is empty. Returns a status dict."""
    from sqlalchemy import text
    from backend.db.db_utils import get_engine

    engine = get_engine()

    # Apply schema — idempotent, safe to run at any time
    schema_path = os.path.join(os.path.dirname(__file__), 'db', 'schema.sql')
    with open(schema_path) as f:
        schema_sql = f.read()
    with engine.begin() as conn:
        for stmt in schema_sql.split(';'):
            stmt = stmt.strip()
            if stmt:
                conn.execute(text(stmt))
    log.info("Schema verified")

    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM economic_data")).scalar()

    from backend.db.model_storage import model_exists

    if count and count > 0:
        models_exist = model_exists('unemployment_xgb') and model_exists('inflation_xgb')
        if models_exist:
            log.info(f"Database has {count} rows and models exist — skipping initialization")
            return {"status": "skipped", "rows": count}
        log.info(f"Database has {count} rows but models are missing — training...")
        from backend.models.unemployment_model import train as train_unemployment
        from backend.models.inflation_model import train as train_inflation
        train_unemployment()
        train_inflation()
        log.info("Model training complete")
        return {"status": "trained", "rows": count}

    log.info("Database is empty — running initialization (this will take a minute)...")

    from backend.data.ingestion import run_ingestion
    run_ingestion()

    from backend.models.unemployment_model import train as train_unemployment
    from backend.models.inflation_model import train as train_inflation
    train_unemployment()
    train_inflation()

    log.info("Initialization complete")
    return {"status": "initialized"}


_ALLOWED_ORIGINS = [
    r"^http://localhost:\d+$",
    r"^https://macrominds\.vercel\.app$",
    r"^https://macrominds-.*\.vercel\.app$",
]


def is_allowed_origin(origin: str) -> bool:
    if not origin:
        return False
    return any(re.match(pattern, origin) for pattern in _ALLOWED_ORIGINS)


_frontend_dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')


def create_app() -> Flask:
    app = Flask(__name__)

    app.register_blueprint(api_bp)

    @app.before_request
    def handle_preflight():
        log.info(
            "%s %s  origin=%s",
            request.method,
            request.path,
            request.headers.get("Origin", "-"),
        )
        if request.method == "OPTIONS":
            origin = request.headers.get("Origin", "")
            response = app.make_default_options_response()
            if is_allowed_origin(origin):
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin", "")
        if is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    @app.route('/health')
    def health():
        return jsonify({"status": "ok"})

    @app.route('/api/cors-test', methods=['GET'])
    def cors_test():
        return jsonify({"status": "ok", "origin_allowed": True})

    @app.route('/api/init', methods=['POST'])
    def init():
        try:
            result = initialize_if_empty()
            return jsonify(result), 200
        except Exception as exc:
            log.exception("Initialization failed")
            return jsonify({"status": "error", "message": str(exc)}), 500

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path and os.path.exists(os.path.join(_frontend_dist, path)):
            return send_from_directory(_frontend_dist, path)
        return send_from_directory(_frontend_dist, 'index.html')

    log.info("Registered routes:")
    with app.app_context():
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
            log.info(f"  {rule.methods - {'HEAD', 'OPTIONS'}}  {rule.rule}")

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5001)),
        debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true',
    )
