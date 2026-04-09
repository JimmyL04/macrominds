# Flask API blueprint — predictions, historical, simulate, backtest, forecast

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
from backend.data.ingestion import run_ingestion

log = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api')


def _err(message: str, status: int = 400):
    return jsonify({"error": message}), status


@api_bp.route('/refresh', methods=['POST'])
def refresh():
    # runs ingestion pipeline; returns how many new rows landed
    try:
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            before = conn.execute(text("SELECT COUNT(*) FROM economic_data")).scalar()
    except Exception as exc:
        log.exception("Failed to count rows before ingestion")
        return jsonify({"status": "error", "message": f"DB error: {exc}"}), 500

    try:
        df = run_ingestion()
    except Exception as exc:
        log.exception("Ingestion pipeline failed")
        return jsonify({"status": "error", "message": f"Ingestion failed: {exc}"}), 500

    try:
        from sqlalchemy import text as _text
        with engine.connect() as conn:
            after = conn.execute(_text("SELECT COUNT(*) FROM economic_data")).scalar()
        last_updated = df.index[-1].date().isoformat() if len(df) > 0 else None
    except Exception as exc:
        log.exception("Failed to count rows after ingestion")
        return jsonify({"status": "error", "message": f"Post-ingestion DB error: {exc}"}), 500

    return jsonify({
        "status":       "success",
        "last_updated": last_updated,
        "new_records":  int(after - before),
    })


@api_bp.route('/migrate', methods=['POST'])
def migrate():
    """Run the full schema.sql against the database — creates any missing tables."""
    import os
    from sqlalchemy import text
    try:
        schema_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'schema.sql')
        with open(schema_path) as f:
            schema_sql = f.read()
        engine = get_engine()
        with engine.begin() as conn:
            for stmt in schema_sql.split(';'):
                stmt = stmt.strip()
                if stmt:
                    conn.execute(text(stmt))
        log.info("Migration complete")
        return jsonify({"status": "success", "message": "Schema applied successfully"})
    except Exception as exc:
        log.exception("Migration failed")
        return _err(f"Migration failed: {exc}", 500)


@api_bp.route('/train', methods=['POST'])
def train_models():
    try:
        from backend.models.unemployment_model import train as train_unemployment
        from backend.models.inflation_model import train as train_inflation
        train_unemployment()
        train_inflation()
        return jsonify({"status": "success", "message": "Models trained successfully"})
    except Exception as exc:
        log.exception("Model training failed")
        return _err(f"Training failed: {exc}", 500)


@api_bp.route('/predictions', methods=['GET'])
def predictions():
    # returns latest unemployment + inflation nowcast
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

    try:
        df = build_features()
        latest_date = df.index[-1].date().isoformat()
        # diagnostic: GDP is annual World Bank data — consecutive rows are identical
        gdp_tail = df['GDP_Growth'].dropna().tail(2)
        log.info(
            "GDP_Growth last 2 rows: %s",
            gdp_tail.round(4).to_dict(),
        )
    except Exception:
        latest_date = None

    return jsonify({
        "date": latest_date,
        "unemployment_prediction": round(unemp_pred, 4),
        "inflation_prediction": round(inf_pred, 4),
        "features_used": {k: round(v, 6) for k, v in features.items()},
    })


@api_bp.route('/historical', methods=['GET'])
def historical():
    # returns historical rows from economic_data, optional start_date/end_date params
    start_date = request.args.get('start_date')
    end_date   = request.args.get('end_date')

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


@api_bp.route('/simulate', methods=['GET'])
def simulate():
    # what-if scenario: supply raw inputs, get predictions back
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


@api_bp.route('/backtest', methods=['GET'])
def backtest():
    # runs both models over historical rows; returns actual vs predicted
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


@api_bp.route('/forecast', methods=['GET'])
def forecast():
    # Prophet multi-step forecast — produces confidence intervals (yhat_lower/upper)
    try:
        months = int(request.args.get('months', 6))
    except ValueError:
        return _err("months must be an integer")

    if not (1 <= months <= 24):
        return _err("months must be between 1 and 24")

    MONTH_NAMES = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]

    try:
        import io
        import contextlib
        import pandas as pd
        from prophet import Prophet
        logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

        df = build_features()

        # uniform month-start index required by Prophet
        unemp_series = df['Unemployment'].dropna().copy()
        inf_series   = df['Inflation_Rate'].dropna().copy()
        unemp_series.index = pd.DatetimeIndex(unemp_series.index).to_period('M').to_timestamp()
        inf_series.index   = pd.DatetimeIndex(inf_series.index).to_period('M').to_timestamp()

        unemp_df = pd.DataFrame({'ds': unemp_series.index, 'y': unemp_series.values})
        inf_df   = pd.DataFrame({'ds': inf_series.index,   'y': inf_series.values})

        log.info(
            "Unemployment last 3 actuals: %s",
            unemp_series.tail(3).round(4).to_dict(),
        )
        log.info(
            "Inflation last 3 actuals: %s",
            inf_series.tail(4).round(4).to_dict(),
        )

        devnull = io.StringIO()
        try:
            with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
                unemp_model = Prophet(
                    growth='linear',
                    seasonality_mode='additive',
                    changepoint_prior_scale=0.5,
                    n_changepoints=25,
                    interval_width=0.65,
                    uncertainty_samples=500,
                    yearly_seasonality=True,
                    weekly_seasonality=False,
                    daily_seasonality=False,
                )
                unemp_model.fit(unemp_df)
                unemp_future = unemp_model.make_future_dataframe(periods=months, freq='MS')
                unemp_fcst   = unemp_model.predict(unemp_future)

                inf_model = Prophet(
                    growth='linear',
                    seasonality_mode='multiplicative',
                    changepoint_prior_scale=0.5,
                    n_changepoints=25,
                    interval_width=0.65,
                    uncertainty_samples=500,
                    yearly_seasonality=True,
                    weekly_seasonality=False,
                    daily_seasonality=False,
                )
                inf_model.add_seasonality(name='monthly', period=30.5, fourier_order=5)
                inf_model.fit(inf_df)
                inf_future = inf_model.make_future_dataframe(periods=months, freq='MS')
                inf_fcst   = inf_model.predict(inf_future)

            # keep only the future rows beyond the last observed date
            unemp_fcst = unemp_fcst[unemp_fcst['ds'] > unemp_series.index[-1]].head(months).reset_index(drop=True)
            inf_fcst   = inf_fcst[inf_fcst['ds']     > inf_series.index[-1]].head(months).reset_index(drop=True)

        except Exception as prophet_exc:
            log.warning("Prophet failed (%s) — falling back to ARIMA", prophet_exc)
            from statsmodels.tsa.arima.model import ARIMA

            future_unemp = pd.date_range(
                start=unemp_series.index[-1] + pd.DateOffset(months=1),
                periods=months,
                freq='MS',
            )
            future_inf = pd.date_range(
                start=inf_series.index[-1] + pd.DateOffset(months=1),
                periods=months,
                freq='MS',
            )

            u_res = ARIMA(unemp_series.values, order=(2, 1, 2)).fit().get_forecast(months)
            u_ci  = u_res.conf_int(alpha=0.35)
            unemp_fcst = pd.DataFrame({
                'ds':         future_unemp,
                'yhat':       u_res.predicted_mean,
                'yhat_lower': u_ci.iloc[:, 0].values,
                'yhat_upper': u_ci.iloc[:, 1].values,
            })

            i_res = ARIMA(inf_series.values, order=(2, 1, 2)).fit().get_forecast(months)
            i_ci  = i_res.conf_int(alpha=0.35)
            inf_fcst = pd.DataFrame({
                'ds':         future_inf,
                'yhat':       i_res.predicted_mean,
                'yhat_lower': i_ci.iloc[:, 0].values,
                'yhat_upper': i_ci.iloc[:, 1].values,
            })

        # shift correction — anchors forecast to the last actual if gap exceeds 0.2 pp
        unemp_last   = float(unemp_series.iloc[-1])
        unemp_gap    = unemp_last - float(unemp_fcst.iloc[0]['yhat'])
        log.info("Unemployment  last_actual=%.4f  first_forecast=%.4f  gap=%.4f",
                 unemp_last, float(unemp_fcst.iloc[0]['yhat']), unemp_gap)
        if abs(unemp_gap) > 0.2:
            unemp_fcst['yhat']       += unemp_gap
            unemp_fcst['yhat_lower'] += unemp_gap
            unemp_fcst['yhat_upper'] += unemp_gap
            log.info("Unemployment shift applied; corrected first_forecast=%.4f",
                     float(unemp_fcst.iloc[0]['yhat']))

        inf_last  = float(inf_series.iloc[-1])
        inf_gap   = inf_last - float(inf_fcst.iloc[0]['yhat'])
        log.info("Inflation  last_actual=%.4f  first_forecast=%.4f  gap=%.4f",
                 inf_last, float(inf_fcst.iloc[0]['yhat']), inf_gap)
        if abs(inf_gap) > 0.2:
            inf_fcst['yhat']       += inf_gap
            inf_fcst['yhat_lower'] += inf_gap
            inf_fcst['yhat_upper'] += inf_gap
            log.info("Inflation shift applied; corrected first_forecast=%.4f",
                     float(inf_fcst.iloc[0]['yhat']))

        # clip to plausible ranges after any shift
        unemp_fcst['yhat']       = unemp_fcst['yhat'].clip(lower=2.0, upper=15.0)
        unemp_fcst['yhat_lower'] = unemp_fcst['yhat_lower'].clip(lower=2.0, upper=15.0)
        unemp_fcst['yhat_upper'] = unemp_fcst['yhat_upper'].clip(lower=2.0, upper=15.0)
        inf_fcst['yhat']         = inf_fcst['yhat'].clip(lower=-2.0, upper=20.0)
        inf_fcst['yhat_lower']   = inf_fcst['yhat_lower'].clip(lower=-2.0, upper=20.0)
        inf_fcst['yhat_upper']   = inf_fcst['yhat_upper'].clip(lower=-2.0, upper=20.0)

        log.info("Unemployment final first 3: %s",
                 unemp_fcst[['ds','yhat','yhat_lower','yhat_upper']].head(3).round(4).to_dict('records'))
        log.info("Inflation final first 3: %s",
                 inf_fcst[['ds','yhat','yhat_lower','yhat_upper']].head(3).round(4).to_dict('records'))

    except Exception as exc:
        log.exception("Prophet forecast failed")
        return _err(f"Forecast failed: {exc}", 500)

    results = []
    for i in range(min(len(unemp_fcst), len(inf_fcst))):
        ts       = unemp_fcst.iloc[i]['ds']
        date_str = f"{MONTH_NAMES[ts.month - 1]} {ts.year}"
        results.append({
            "date":                         date_str,
            "predicted_unemployment":       round(float(unemp_fcst.iloc[i]['yhat']),       4),
            "predicted_unemployment_lower": round(float(unemp_fcst.iloc[i]['yhat_lower']), 4),
            "predicted_unemployment_upper": round(float(unemp_fcst.iloc[i]['yhat_upper']), 4),
            "predicted_inflation":          round(float(inf_fcst.iloc[i]['yhat']),         4),
            "predicted_inflation_lower":    round(float(inf_fcst.iloc[i]['yhat_lower']),   4),
            "predicted_inflation_upper":    round(float(inf_fcst.iloc[i]['yhat_upper']),   4),
        })

    return jsonify({"count": len(results), "data": results})
