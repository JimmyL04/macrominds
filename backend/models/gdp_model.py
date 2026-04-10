# GDP model: Prophet quarterly forecast + XGBoost current-quarter nowcast

import io
import os
import sys
import logging
import contextlib
import warnings

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_squared_error, r2_score

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.db.db_utils import get_engine                         # noqa: E402
from backend.db.model_storage import save_model, load_model, model_exists  # noqa: E402
from backend.data.preprocessing import build_features              # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)
warnings.filterwarnings('ignore')

PROPHET_MODEL_NAME = 'gdp_prophet'
XGB_MODEL_NAME     = 'gdp_xgb'

# XGBoost uses existing lag features + previous-quarter GDP
GDP_XGB_FEATURES = [
    'Unemployment_Lag1',
    'Inflation_Lag1',
    'Claims_Z_Lag1',
    'Income_Z_Lag1',
    'GDP_Growth_Lag1',
]


def _get_quarterly_gdp() -> pd.Series:
    """Load GDP from DB, deduplicated to one value per quarter-start."""
    engine = get_engine()
    df = pd.read_sql(
        "SELECT date, gdp_growth FROM economic_data ORDER BY date ASC",
        engine,
        parse_dates=['date'],
    )
    df.set_index('date', inplace=True)
    df.index = pd.to_datetime(df.index)
    gdp = df['gdp_growth'].dropna()
    # forward-filled monthly data → take first value of each QS period
    return gdp.resample('QS').first().dropna()


def _get_gdp_feature_df() -> pd.DataFrame:
    """Build feature matrix for XGBoost GDP nowcast."""
    df = build_features()                          # includes GDP_Growth col
    df['GDP_Growth_Lag1'] = df['GDP_Growth'].shift(3)  # 3-month lag = 1 prior quarter
    return df.dropna(subset=GDP_XGB_FEATURES)


def _train_prophet() -> None:
    from prophet import Prophet
    logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

    gdp_q = _get_quarterly_gdp()
    log.info(
        "GDP quarterly: %d quarters  [%s → %s]",
        len(gdp_q), gdp_q.index[0].date(), gdp_q.index[-1].date(),
    )

    gdp_df = pd.DataFrame({'ds': gdp_q.index, 'y': gdp_q.values})

    devnull = io.StringIO()
    with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
        model = Prophet(
            seasonality_mode='additive',
            changepoint_prior_scale=0.3,
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            interval_width=0.70,
            uncertainty_samples=500,
        )
        model.add_seasonality(name='quarterly', period=91.25, fourier_order=5)
        model.fit(gdp_df)

    save_model(PROPHET_MODEL_NAME, model)
    log.info("Prophet GDP model saved as '%s'", PROPHET_MODEL_NAME)


def _train_xgb() -> None:
    df = _get_gdp_feature_df()

    X = df[GDP_XGB_FEATURES]
    y = df['GDP_Growth']

    cutoff  = '2022-01-01'
    X_train = X.loc[:cutoff]
    y_train = y.loc[:cutoff]
    X_test  = X.loc[cutoff:]
    y_test  = y.loc[cutoff:]

    log.info("GDP XGBoost: train=%d  test=%d rows", len(X_train), len(X_test))

    model = xgb.XGBRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=3,
        objective='reg:squarederror',
        early_stopping_rounds=30,
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
    log.info("GDP XGBoost  RMSE=%.4f  R²=%.4f", rmse, r2)

    save_model(XGB_MODEL_NAME, model)
    log.info("XGBoost GDP model saved as '%s'", XGB_MODEL_NAME)


def train() -> None:
    log.info("=== GDP Model Training ===")
    _train_prophet()
    _train_xgb()


def forecast_gdp(months: int) -> pd.DataFrame:
    """
    Prophet quarterly forecast for `months` months ahead.
    Returns a DataFrame with columns: ds, yhat, yhat_lower, yhat_upper.
    One row per future quarter (not every month).
    """
    logging.getLogger("cmdstanpy").setLevel(logging.ERROR)

    if not model_exists(PROPHET_MODEL_NAME):
        log.info("GDP Prophet model missing — training now...")
        _train_prophet()

    model = load_model(PROPHET_MODEL_NAME)
    gdp_q = _get_quarterly_gdp()

    n_quarters = (months + 2) // 3  # enough quarters to cover all months

    devnull = io.StringIO()
    with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
        future   = model.make_future_dataframe(periods=n_quarters, freq='QS')
        forecast = model.predict(future)

    forecast = (
        forecast[forecast['ds'] > gdp_q.index[-1]]
        .head(n_quarters)
        .reset_index(drop=True)
    )

    # Shift correction — anchor to last actual if gap > 0.5 pp
    last_actual = float(gdp_q.iloc[-1])
    gap = last_actual - float(forecast.iloc[0]['yhat'])
    log.info(
        "GDP  last_actual=%.4f  first_forecast=%.4f  gap=%.4f",
        last_actual, float(forecast.iloc[0]['yhat']), gap,
    )
    if abs(gap) > 0.5:
        for col in ['yhat', 'yhat_lower', 'yhat_upper']:
            forecast[col] += gap

    for col in ['yhat', 'yhat_lower', 'yhat_upper']:
        forecast[col] = forecast[col].clip(lower=-10.0, upper=15.0)

    return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]


def nowcast_gdp() -> tuple[float, str]:
    """
    XGBoost current-quarter GDP nowcast.
    Returns (predicted_value, quarter_label) e.g. (2.3, 'Q1 2026').
    """
    if not model_exists(XGB_MODEL_NAME):
        log.info("GDP XGBoost model missing — training now...")
        _train_xgb()

    model = load_model(XGB_MODEL_NAME)
    df    = _get_gdp_feature_df()

    latest      = df[GDP_XGB_FEATURES].iloc[-1]
    latest_date = df.index[-1]

    pred = float(model.predict(pd.DataFrame([latest]))[0])

    q             = (latest_date.month - 1) // 3 + 1
    quarter_label = f"Q{q} {latest_date.year}"

    return pred, quarter_label


if __name__ == '__main__':
    train()
