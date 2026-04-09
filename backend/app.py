# Flask app entry point

import os
import sys
import logging

from flask import Flask, jsonify
from flask_cors import CORS

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

    if count and count > 0:
        log.info(f"Database has {count} rows — skipping initialization")
        return {"status": "skipped", "rows": count}

    log.info("Database is empty — running initialization (this will take a minute)...")

    from backend.data.ingestion import run_ingestion
    run_ingestion()

    from backend.models.unemployment_model import train as train_unemployment
    from backend.models.inflation_model import train as train_inflation
    train_unemployment()
    train_inflation()

    log.info("Initialization complete")
    return {"status": "initialized"}


def create_app() -> Flask:
    app = Flask(__name__)

    CORS(app, origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://macrominds-production.up.railway.app",
    ])

    app.register_blueprint(api_bp)

    @app.route('/health')
    def health():
        return jsonify({"status": "ok"})

    @app.route('/api/init', methods=['POST'])
    def init():
        try:
            result = initialize_if_empty()
            return jsonify(result), 200
        except Exception as exc:
            log.exception("Initialization failed")
            return jsonify({"status": "error", "message": str(exc)}), 500

    log.info("Registered routes:")
    with app.app_context():
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
            log.info(f"  {rule.methods - {'HEAD', 'OPTIONS'}}  {rule.rule}")

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(
        host=os.getenv('FLASK_HOST', '0.0.0.0'),
        port=int(os.getenv('FLASK_PORT', 5001)),
        debug=os.getenv('FLASK_DEBUG', 'true').lower() == 'true',
    )
