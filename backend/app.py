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

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(
        host=os.getenv('FLASK_HOST', '0.0.0.0'),
        port=int(os.getenv('FLASK_PORT', 5001)),
        debug=os.getenv('FLASK_DEBUG', 'true').lower() == 'true',
    )
