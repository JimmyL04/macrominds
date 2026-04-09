# trains XGBoost + ARIMA to nowcast unemployment rate

import os
import sys
import logging
import warnings

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_squared_error, r2_score
from statsmodels.tsa.arima.model import ARIMA

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.data.preprocessing import get_training_data, MODEL_FEATURES  # noqa: E402
from backend.db.model_storage import save_model, load_model, model_exists  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)
warnings.filterwarnings('ignore')   # suppress ARIMA convergence noise

TRAIN_CUTOFF = '2022-01-01'
TEST_END     = '2025-12-31'
MODEL_NAME   = 'unemployment_xgb'


def _train_xgboost(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test:  pd.DataFrame,
    y_test:  pd.Series,
) -> tuple[xgb.XGBRegressor, np.ndarray, float, float]:
    model = xgb.XGBRegressor(
        n_estimators=1000,
        learning_rate=0.05,
        max_depth=3,
        objective='reg:squarederror',
        early_stopping_rounds=50,
        random_state=42,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_test, y_test)],
        verbose=False,
    )
    preds = model.predict(X_test)
    rmse  = np.sqrt(mean_squared_error(y_test, preds))
    r2    = r2_score(y_test, preds)
    return model, preds, rmse, r2


def _train_arima(
    y_train: pd.Series,
    y_test:  pd.Series,
) -> tuple[object, np.ndarray, float, float]:
    # ARIMA needs a uniform-frequency DatetimeIndex
    y_tr = y_train.copy()
    y_tr.index = pd.DatetimeIndex(y_tr.index).to_period('M').to_timestamp()

    try:
        result = ARIMA(y_tr, order=(2, 1, 2)).fit()
        preds  = np.array(result.forecast(steps=len(y_test)))
        rmse   = np.sqrt(mean_squared_error(y_test.values, preds))
        r2     = r2_score(y_test.values, preds)
    except Exception as exc:
        log.warning(f"ARIMA fitting failed: {exc}")
        preds  = np.full(len(y_test), np.nan)
        rmse   = np.nan
        r2     = np.nan
        result = None

    return result, preds, rmse, r2


def train() -> xgb.XGBRegressor:
    log.info("=== Unemployment Model Training ===")
    log.info(f"Split: train ≤ {TRAIN_CUTOFF}  |  test {TRAIN_CUTOFF} – {TEST_END}")

    X_train, y_train, X_test, y_test = get_training_data(TRAIN_CUTOFF, TEST_END)

    log.info(f"Training XGBoost on {len(X_train)} rows...")
    xgb_model, _, xgb_rmse, xgb_r2 = _train_xgboost(X_train, y_train, X_test, y_test)

    log.info(f"Training ARIMA(2,1,2) on {len(y_train)} rows...")
    _, _, arima_rmse, arima_r2 = _train_arima(y_train, y_test)

    log.info(f"XGBoost  RMSE={xgb_rmse:.4f}  R²={xgb_r2:.4f}")
    if not np.isnan(arima_rmse):
        log.info(f"ARIMA    RMSE={arima_rmse:.4f}  R²={arima_r2:.4f}")
    else:
        log.info("ARIMA    failed")

    # always save XGBoost — ARIMA can't do feature-based inference at prediction time
    save_model(MODEL_NAME, xgb_model)
    log.info(f"XGBoost saved to database as '{MODEL_NAME}'")

    return xgb_model


def predict(features_dict: dict) -> float:
    if not model_exists(MODEL_NAME):
        log.info(f"'{MODEL_NAME}' not found in database — training now...")
        train()

    model = load_model(MODEL_NAME)
    X = pd.DataFrame([features_dict])[MODEL_FEATURES]
    return float(model.predict(X)[0])


if __name__ == '__main__':
    train()
