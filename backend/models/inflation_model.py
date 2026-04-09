# trains XGBoost to nowcast inflation rate

import os
import sys
import logging

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_squared_error, r2_score

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.data.preprocessing import build_features, MODEL_FEATURES  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)

TRAIN_CUTOFF = '2022-01-01'
TEST_END     = '2025-12-31'
TARGET       = 'Inflation_Rate'
MODEL_PATH   = os.path.join(os.path.dirname(__file__), 'inflation_xgb.pkl')


def _get_inflation_splits(
    cutoff_date: str,
    end_test_date: str,
) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    # can't use get_training_data() — it hardcodes Unemployment as target
    df = build_features()

    df = df.dropna(subset=MODEL_FEATURES + [TARGET])

    train = df.loc[:cutoff_date]
    test  = df.loc[cutoff_date:end_test_date]

    X_train = train[MODEL_FEATURES]
    y_train = train[TARGET]
    X_test  = test[MODEL_FEATURES]
    y_test  = test[TARGET]

    log.info(
        f"Train: {len(X_train)} rows  "
        f"[{X_train.index[0].date()} → {X_train.index[-1].date()}]"
    )
    log.info(
        f"Test : {len(X_test)} rows   "
        f"[{X_test.index[0].date()} → {X_test.index[-1].date()}]"
    )
    return X_train, y_train, X_test, y_test


def train() -> xgb.XGBRegressor:
    log.info("=== Inflation Model Training ===")
    log.info(f"Split: train ≤ {TRAIN_CUTOFF}  |  test {TRAIN_CUTOFF} – {TEST_END}")

    X_train, y_train, X_test, y_test = _get_inflation_splits(TRAIN_CUTOFF, TEST_END)

    model = xgb.XGBRegressor(
        n_estimators=1000,
        learning_rate=0.05,
        max_depth=3,
        objective='reg:squarederror',
        early_stopping_rounds=50,
        random_state=42,
    )

    log.info(f"Training XGBoost on {len(X_train)} rows...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_train, y_train), (X_test, y_test)],
        verbose=False,
    )

    preds = model.predict(X_test)
    rmse  = np.sqrt(mean_squared_error(y_test, preds))
    r2    = r2_score(y_test, preds)

    print("\n--- Inflation Model Results ---")
    print(f"{'Model':<22} {'RMSE':>8} {'R²':>8}")
    print("-" * 42)
    print(f"{'XGBoost':<22} {rmse:>8.4f} {r2:>8.4f}")
    print()

    joblib.dump(model, MODEL_PATH)
    log.info(f"Model saved → {MODEL_PATH}")

    return model


def predict(features_dict: dict) -> float:
    if not os.path.exists(MODEL_PATH):
        log.info("inflation_xgb.pkl not found — training now...")
        train()

    model = joblib.load(MODEL_PATH)
    X = pd.DataFrame([features_dict])[MODEL_FEATURES]
    return float(model.predict(X)[0])


if __name__ == '__main__':
    train()
