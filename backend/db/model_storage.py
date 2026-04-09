# Stores and loads serialized ML models in PostgreSQL as BYTEA.
# Replaces filesystem .pkl files so models survive Railway redeployments.

import pickle
import logging
import psycopg2
from sqlalchemy import text
from backend.db.db_utils import get_engine

log = logging.getLogger(__name__)


def save_model(name: str, model) -> None:
    data = psycopg2.Binary(pickle.dumps(model))
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO model_storage (name, model_data, trained_at)
            VALUES (:name, :data, NOW())
            ON CONFLICT (name) DO UPDATE
              SET model_data = EXCLUDED.model_data,
                  trained_at = NOW()
        """), {"name": name, "data": data})
    log.info(f"Model '{name}' saved to database")


def load_model(name: str):
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT model_data FROM model_storage WHERE name = :name"),
            {"name": name},
        ).fetchone()
    if row is None:
        raise FileNotFoundError(
            f"Model '{name}' not found in database. Run POST /api/train first."
        )
    return pickle.loads(bytes(row[0]))


def model_exists(name: str) -> bool:
    try:
        engine = get_engine()
        with engine.connect() as conn:
            count = conn.execute(
                text("SELECT COUNT(*) FROM model_storage WHERE name = :name"),
                {"name": name},
            ).scalar()
        return bool(count)
    except Exception:
        return False
