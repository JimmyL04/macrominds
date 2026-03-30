"""
backend/routes/api.py

Flask Blueprint exposing the MacroMinds prediction API.

Routes
------
GET /api/predictions   — latest unemployment + inflation nowcast
GET /api/historical    — historical DB rows (optional start_date / end_date)
GET /api/simulate      — what-if scenario prediction
GET /api/backtest      — model accuracy over historical data (optional start_date)
GET /api/forecast      — rolling multi-month forward nowcast (optional months, default 6)
"""

import os
import sys
import logging

from flask import Blueprint, jsonify, request

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.data.preprocessing import get_latest_features, build_features, MODEL_FEATURES
from backend.models.unemployment_model import predict as predict_unemployment
from backend.models.inflation_model import predict as predict_inflation
from backend.db.db_utils import get_engine

log = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api')


def _err(message: str, status: int = 400):
    return jsonify({"error": message}), status


# ---------------------------------------------------------------------------
# GET /api/predictions
# ---------------------------------------------------------------------------

@api_bp.route('/predictions', methods=['GET'])
def predictions():
    """
    Returns unemployment and inflation nowcasts for the most recent data point.

    Response
    --------
    {
        "date": "YYYY-MM-DD",
        "unemployment_prediction": float,
        "inflation_prediction": float,
        "features_used": { ... }
    }
    """
    try:
        features = get_latest_features()
    except Exception as exc:
        log.exception("Failed to load latest features")
        return _err(f"Feature loading failed: {exc}", 500)

    try:
        unemp_pred = predict_unemployment(features)
    except FileNotFoundError as exc:
        return _err(str(exc), 503)
    except Exception as exc:
        log.exception("Unemployment prediction failed")
        return _err(f"Unemployment prediction failed: {exc}", 500)

    try:
        inf_pred = predict_inflation(features)
    except FileNotFoundError as exc:
        return _err(str(exc), 503)
    except Exception as exc:
        log.exception("Inflation prediction failed")
        return _err(f"Inflation prediction failed: {exc}", 500)

    # Retrieve the date of the latest feature row from the DB
    try:
        df = build_features()
        latest_date = df.index[-1].date().isoformat()
    except Exception:
        latest_date = None

    return jsonify({
        "date": latest_date,
        "unemployment_prediction": round(unemp_pred, 4),
        "inflation_prediction": round(inf_pred, 4),
        "features_used": {k: round(v, 6) for k, v in features.items()},
    })


# ---------------------------------------------------------------------------
# GET /api/historical
# ---------------------------------------------------------------------------

@api_bp.route('/historical', methods=['GET'])
def historical():
    """
    Returns historical rows from the economic_data table.

    Query params (all optional)
    ---------------------------
    start_date : YYYY-MM-DD   default: no lower bound
    end_date   : YYYY-MM-DD   default: no upper bound

    Response
    --------
    {
        "count": int,
        "data": [
            {
                "date": "YYYY-MM-DD",
                "unemployment": float,
                "inflation_cpi": float,
                "inflation_rate": float,
                "weekly_claims": float,
                "personal_income": float,
                "income_growth": float,
                "gdp_growth": float
            },
            ...
        ]
    }
    """
    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')

    # Build parameterised query
    conditions = []
    params: dict = {}

    if start_date:
        conditions.append("date >= :start_date")
        params['start_date'] = start_date
    if end_date:
        conditions.append("date <= :end_date")
        params['end_date'] = end_date

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    query = f"""
        SELECT date, unemployment, inflation_cpi, inflation_rate,
               weekly_claims, personal_income, income_growth, gdp_growth
        FROM economic_data
        {where}
        ORDER BY date ASC
    """

    try:
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            rows = conn.execute(text(query), params).mappings().all()
    except Exception as exc:
        log.exception("Database query failed")
        return _err(f"Database error: {exc}", 500)

    data = [
        {
            "date":            str(r["date"]),
            "unemployment":    r["unemployment"],
            "inflation_cpi":   r["inflation_cpi"],
            "inflation_rate":  r["inflation_rate"],
            "weekly_claims":   r["weekly_claims"],
            "personal_income": r["personal_income"],
            "income_growth":   r["income_growth"],
            "gdp_growth":      r["gdp_growth"],
        }
        for r in rows
    ]

    return jsonify({"count": len(data), "data": data})


# ---------------------------------------------------------------------------
# GET /api/simulate
# ---------------------------------------------------------------------------

@api_bp.route('/simulate', methods=['GET'])
def simulate():
    """
    What-if scenario: supply raw economic inputs and get model predictions.

    The route replicates the notebook's run_simulation() (Cell 12) by
    z-scoring the raw claims and income values using the full-history
    mean/std from the feature dataset, then calling both models.

    Required query params
    ---------------------
    claims             : float  — raw weekly initial claims (e.g. 250000)
    inflation          : float  — current YoY inflation rate % (e.g. 3.5)
    income             : float  — current YoY income growth % (e.g. 2.1)
    prev_unemployment  : float  — previous month unemployment rate % (e.g. 4.0)

    Response
    --------
    {
        "inputs": { ... },
        "features": { ... },
        "unemployment_prediction": float,
        "inflation_prediction": float
    }
    """
    required = ['claims', 'inflation', 'income', 'prev_unemployment']
    missing  = [p for p in required if request.args.get(p) is None]
    if missing:
        return _err(f"Missing required query params: {', '.join(missing)}")

    try:
        claims_raw    = float(request.args['claims'])
        inflation_raw = float(request.args['inflation'])
        income_raw    = float(request.args['income'])
        prev_unemp    = float(request.args['prev_unemployment'])
    except ValueError:
        return _err("All query params must be numeric")

    # Z-score the raw claims and income using full-history stats
    try:
        df = build_features()
    except Exception as exc:
        log.exception("Failed to build feature dataset for simulation")
        return _err(f"Feature dataset error: {exc}", 500)

    claims_mean = df['Weekly_Claims'].mean()
    claims_std  = df['Weekly_Claims'].std()
    income_mean = df['Income_Growth'].mean()
    income_std  = df['Income_Growth'].std()

    features = {
        'Claims_Z_Lag1':       (claims_raw - claims_mean) / claims_std,
        'Income_Z_Lag1':       (income_raw - income_mean) / income_std,
        'Inflation_Lag1':      inflation_raw,
        'Unemployment_Lag1':   prev_unemp,
    }

    try:
        unemp_pred = predict_unemployment(features)
    except FileNotFoundError as exc:
        return _err(str(exc), 503)
    except Exception as exc:
        log.exception("Simulation unemployment prediction failed")
        return _err(f"Unemployment prediction failed: {exc}", 500)

    try:
        inf_pred = predict_inflation(features)
    except FileNotFoundError as exc:
        return _err(str(exc), 503)
    except Exception as exc:
        log.exception("Simulation inflation prediction failed")
        return _err(f"Inflation prediction failed: {exc}", 500)

    return jsonify({
        "inputs": {
            "claims":            claims_raw,
            "inflation":         inflation_raw,
            "income":            income_raw,
            "prev_unemployment": prev_unemp,
        },
        "features": {k: round(v, 6) for k, v in features.items()},
        "unemployment_prediction": round(unemp_pred, 4),
        "inflation_prediction":    round(inf_pred, 4),
    })


# ---------------------------------------------------------------------------
# GET /api/backtest
# ---------------------------------------------------------------------------

@api_bp.route('/backtest', methods=['GET'])
def backtest():
    """
    Runs both models over historical feature rows and returns actual vs.
    predicted values so the UI can visualise model accuracy over time.

    Query params (optional)
    -----------------------
    start_date : YYYY-MM-DD — only return rows from this date onwards

    Response
    --------
    {
        "count": int,
        "data": [
            {
                "date": "YYYY-MM-DD",
                "actual_unemployment": float | null,
                "predicted_unemployment": float | null,
                "actual_inflation": float | null,
                "predicted_inflation": float | null
            },
            ...
        ]
    }
    """
    start_date = request.args.get('start_date')

    try:
        df = build_features()
    except Exception as exc:
        log.exception("build_features failed in backtest")
        return _err(f"Feature dataset error: {exc}", 500)

    if start_date:
        df = df.loc[start_date:]

    results = []
    for ts, row in df.iterrows():
        features_dict = {feat: float(row[feat]) for feat in MODEL_FEATURES}

        try:
            unemp_pred = predict_unemployment(features_dict)
        except FileNotFoundError as exc:
            return _err(str(exc), 503)
        except Exception:
            unemp_pred = None

        try:
            inf_pred = predict_inflation(features_dict)
        except FileNotFoundError as exc:
            return _err(str(exc), 503)
        except Exception:
            inf_pred = None

        import math
        def _safe(v):
            if v is None:
                return None
            try:
                return None if math.isnan(float(v)) else round(float(v), 4)
            except (TypeError, ValueError):
                return None

        results.append({
            "date":                   ts.date().isoformat(),
            "actual_unemployment":    _safe(row.get("Unemployment")),
            "predicted_unemployment": _safe(unemp_pred),
            "actual_inflation":       _safe(row.get("Inflation_Rate")),
            "predicted_inflation":    _safe(inf_pred),
        })

    return jsonify({"count": len(results), "data": results})


# ---------------------------------------------------------------------------
# GET /api/forecast
# ---------------------------------------------------------------------------

@api_bp.route('/forecast', methods=['GET'])
def forecast():
    """
    Rolling multi-month forward nowcast.

    Each step feeds the previous step's predicted unemployment and inflation
    back as Unemployment_Lag1 / Inflation_Lag1 for the next step.
    Claims_Z_Lag1 and Income_Z_Lag1 are held constant at their latest
    observed values (no future macro data is available for those series).

    Query params (optional)
    -----------------------
    months : int  — number of months to forecast (default 6, max 24)

    Response
    --------
    {
        "count": int,
        "data": [
            { "date": "Apr 2026", "predicted_unemployment": float, "predicted_inflation": float },
            ...
        ]
    }
    """
    try:
        months = int(request.args.get('months', 6))
    except ValueError:
        return _err("months must be an integer")

    if not (1 <= months <= 24):
        return _err("months must be between 1 and 24")

    try:
        import pandas as pd
        latest_features = get_latest_features()
        df = build_features()
        last_date = df.index[-1]
    except Exception as exc:
        log.exception("Failed to load latest features for forecast")
        return _err(f"Feature loading failed: {exc}", 500)

    MONTH_NAMES = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]

    try:
        current_features = dict(latest_features)
        results = []

        for i in range(months):
            # Predict with the current feature state
            unemp_pred = predict_unemployment(current_features)
            inf_pred   = predict_inflation(current_features)

            # Advance date by (i+1) months from the last historical date
            forecast_ts = last_date + pd.DateOffset(months=i + 1)
            date_str    = f"{MONTH_NAMES[forecast_ts.month - 1]} {forecast_ts.year}"

            results.append({
                "date":                   date_str,
                "predicted_unemployment": round(unemp_pred, 4),
                "predicted_inflation":    round(inf_pred, 4),
            })

            # Rolling update: feed predictions back as the next step's lags
            current_features['Unemployment_Lag1'] = unemp_pred
            current_features['Inflation_Lag1']    = inf_pred
            # Claims_Z_Lag1 and Income_Z_Lag1 stay constant

    except FileNotFoundError as exc:
        return _err(str(exc), 503)
    except Exception as exc:
        log.exception("Forecast loop failed")
        return _err(f"Forecast failed: {exc}", 500)

    return jsonify({"count": len(results), "data": results})
