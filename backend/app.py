# Flask app entry point

import os
import sys
import logging

from flask import Flask
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


def initialize_if_empty() -> None:
    """Create schema and seed data on first cold start. Safe to re-run — all DDL is IF NOT EXISTS."""
    from sqlalchemy import text
    from backend.db.db_utils import get_engine

    try:
        engine = get_engine()

        # Apply schema — idempotent, safe to run on every startup
        schema_path = os.path.join(os.path.dirname(__file__), 'db', 'schema.sql')
        with open(schema_path) as f:
            schema_sql = f.read()
        with engine.begin() as conn:
            for stmt in schema_sql.split(';'):
                stmt = stmt.strip()
                if stmt:
                    conn.execute(text(stmt))
        log.info("Schema verified")

        # Check whether the DB already has data
        with engine.connect() as conn:
            count = conn.execute(text("SELECT COUNT(*) FROM economic_data")).scalar()

        if count and count > 0:
            log.info(f"Database has {count} rows — skipping initialization")
            return

        log.info("Database is empty — running first-time initialization (this will take a minute)...")

        from backend.data.ingestion import run_ingestion
        run_ingestion()

        from backend.models.unemployment_model import train as train_unemployment
        from backend.models.inflation_model import train as train_inflation
        train_unemployment()
        train_inflation()

        log.info("First-time initialization complete")

    except Exception:
        log.exception("Startup initialization failed — app will still start")


def create_app() -> Flask:
    app = Flask(__name__)

    # allow vite dev server to call the api
    CORS(app, origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://macrominds-production.up.railway.app",
    ])

    app.register_blueprint(api_bp)

    @app.route('/health')
    def health():
        from flask import jsonify
        return jsonify({"status": "ok"})

    log.info("Registered routes:")
    with app.app_context():
        for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
            log.info(f"  {rule.methods - {'HEAD', 'OPTIONS'}}  {rule.rule}")

    with app.app_context():
        initialize_if_empty()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(
        host=os.getenv('FLASK_HOST', '0.0.0.0'),
        port=int(os.getenv('FLASK_PORT', 5001)),
        debug=os.getenv('FLASK_DEBUG', 'true').lower() == 'true',
    )
