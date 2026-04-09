# reads from db and builds model-ready feature matrices

import os
import sys
import logging

import numpy as np
import pandas as pd

# needed when running as a script directly
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.db.db_utils import get_engine  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)

# features the models expect at prediction time
MODEL_FEATURES = [
    'Claims_Z_Lag1',
    'Income_Z_Lag1',
    'Inflation_Lag1',
    'Unemployment_Lag1',
]
TARGET = 'Unemployment'


def _load_from_db() -> pd.DataFrame:
    # renames db snake_case cols to TitleCase used everywhere else
    engine = get_engine()
    query = """
        SELECT date, unemployment, inflation_cpi, inflation_rate,
               weekly_claims, personal_income, income_growth, gdp_growth
        FROM economic_data
        ORDER BY date ASC
    """
    df = pd.read_sql(query, engine, parse_dates=['date'])
    df.set_index('date', inplace=True)
    df.index = pd.to_datetime(df.index)

    df.rename(columns={
        'unemployment':    'Unemployment',
        'inflation_cpi':   'Inflation',
        'inflation_rate':  'Inflation_Rate',
        'weekly_claims':   'Weekly_Claims',
        'personal_income': 'Personal_Income',
        'income_growth':   'Income_Growth',
        'gdp_growth':      'GDP_Growth',
    }, inplace=True)

    log.info(
        f"Loaded {len(df)} rows from economic_data  "
        f"[{df.index[0].date()} → {df.index[-1].date()}]"
    )
    return df


def _engineer(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # fill yoy gaps in case ingestion left holes
    if df['Inflation_Rate'].isna().any():
        computed = df['Inflation'].pct_change(12) * 100
        df['Inflation_Rate'] = df['Inflation_Rate'].fillna(computed)

    if df['Income_Growth'].isna().any():
        computed = df['Personal_Income'].pct_change(12) * 100
        df['Income_Growth'] = df['Income_Growth'].fillna(computed)

    # lag features (t-1)
    df['Claims_Lag1']       = df['Weekly_Claims'].shift(1)
    df['Inflation_Lag1']    = df['Inflation_Rate'].shift(1)
    df['Income_Lag1']       = df['Income_Growth'].shift(1)
    df['Unemployment_Lag1'] = df['Unemployment'].shift(1)

    # z-score using full-history stats
    for col in ['Unemployment', 'Weekly_Claims', 'Income_Growth']:
        mean, std = df[col].mean(), df[col].std()
        df[f'{col}_Z'] = (df[col] - mean) / std

    # z-scored lag versions for the model
    df['Claims_Z_Lag1'] = df['Weekly_Claims_Z'].shift(1)
    df['Income_Z_Lag1'] = df['Income_Growth_Z'].shift(1)

    required = MODEL_FEATURES + [TARGET]
    before = len(df)
    df.dropna(subset=required, inplace=True)
    dropped = before - len(df)
    if dropped:
        log.info(f"Dropped {dropped} rows with NaN in required columns")

    return df


def build_features() -> pd.DataFrame:
    log.info("=== MacroMinds Preprocessing ===")

    df_raw = _load_from_db()
    df = _engineer(df_raw)

    log.info(f"Shape      : {df.shape[0]} rows × {df.shape[1]} columns")
    log.info(f"Date range : {df.index[0].date()} → {df.index[-1].date()}")
    null_counts = df[MODEL_FEATURES + [TARGET]].isna().sum()
    if null_counts.any():
        log.warning(f"Null counts in model features:\n{null_counts.to_string()}")

    return df


def get_training_data(
    cutoff_date: str,
    end_test_date: str,
) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    df = build_features()

    train = df.loc[:cutoff_date]
    test  = df.loc[cutoff_date:end_test_date]

    X_train = train[MODEL_FEATURES]
    y_train = train[TARGET]
    X_test  = test[MODEL_FEATURES]
    y_test  = test[TARGET]

    log.info(
        f"Train: {len(X_train)} rows  [{X_train.index[0].date()} → {X_train.index[-1].date()}]"
    )
    log.info(
        f"Test : {len(X_test)} rows   [{X_test.index[0].date()} → {X_test.index[-1].date()}]"
    )

    return X_train, y_train, X_test, y_test


def get_latest_features() -> dict:
    df = build_features()
    latest = df[MODEL_FEATURES].iloc[-1]

    log.info(f"Latest feature row: {latest.name.date()}")
    log.info(f"  {latest.to_dict()}")

    return latest.to_dict()


if __name__ == '__main__':
    print("--- build_features() ---")
    df_full = build_features()

    print("--- get_training_data('2015-01-01', '2019-12-31') ---")
    X_tr, y_tr, X_te, y_te = get_training_data('2015-01-01', '2019-12-31')
    print(f"X_train: {X_tr.shape}  y_train: {y_tr.shape}")
    print(f"X_test : {X_te.shape}  y_test : {y_te.shape}")
    print(X_tr.tail(3))

    print("\n--- get_latest_features() ---")
    feats = get_latest_features()
    print(feats)
