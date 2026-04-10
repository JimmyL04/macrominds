# fetches FRED/BLS/World Bank data and upserts to postgres

import os
import json
import logging
import sys
import requests
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fredapi import Fred

# needed when running as a script directly
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if _root not in sys.path:
    sys.path.insert(0, _root)

from backend.db.db_utils import get_engine  # noqa: E402

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
log = logging.getLogger(__name__)


def fetch_fred_data() -> pd.DataFrame:
    api_key = os.getenv('FRED_API_KEY')
    if not api_key:
        raise ValueError("FRED_API_KEY not found in environment / .env")

    fred = Fred(api_key=api_key)

    series_map = {
        'Unemployment':    'UNRATE',
        'Inflation':       'CPIAUCSL',
        'Weekly_Claims':   'ICSA',
        'Personal_Income': 'W875RX1',
    }

    raw = {}
    for name, series_id in series_map.items():
        log.info(f"  FRED  {series_id:12s}  ({name})")
        raw[name] = fred.get_series(series_id)

    df = pd.DataFrame(raw)
    df_monthly = df.resample('MS').mean().ffill().dropna()
    log.info(
        f"FRED data ready: {len(df_monthly)} rows  "
        f"[{df_monthly.index[0].date()} → {df_monthly.index[-1].date()}]"
    )
    return df_monthly


def fetch_bls_data() -> pd.DataFrame:
    api_key = os.getenv('BLS_API_KEY')

    payload: dict = {
        "seriesid": ["CUUR0000SA0"],
        "startyear": "2000",
        "endyear": "2025",
    }
    if api_key:
        payload["registrationkey"] = api_key

    headers = {"Content-type": "application/json"}

    log.info("  BLS   CUUR0000SA0  (CPI-U All Items)")
    try:
        resp = requests.post(
            "https://api.bls.gov/publicAPI/v2/timeseries/data/",
            data=json.dumps(payload),
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        log.warning(f"BLS request failed: {exc} — skipping BLS data")
        return pd.DataFrame()

    json_data = resp.json()

    if json_data.get("status") == "REQUEST_FAILED":
        log.warning(f"BLS API error: {json_data.get('message')} — skipping BLS data")
        return pd.DataFrame()

    rows = []
    for series in json_data.get("Results", {}).get("series", []):
        for item in series["data"]:
            raw_val = item["value"].strip()
            if raw_val in ("-", ""):
                continue
            rows.append({
                "Year":    int(item["year"]),
                "Month":   item["periodName"],
                "BLS_CPI": float(raw_val),
            })

    if not rows:
        log.warning("BLS returned no usable rows — skipping")
        return pd.DataFrame()

    bls_df = pd.DataFrame(rows)
    bls_df["Date"] = pd.to_datetime(
        bls_df["Month"] + " " + bls_df["Year"].astype(str)
    )
    bls_df.set_index("Date", inplace=True)
    bls_df.sort_index(inplace=True)
    bls_df.drop(columns=["Year", "Month"], inplace=True)

    bls_df["BLS_Inflation_Rate"] = bls_df["BLS_CPI"].pct_change(periods=12) * 100
    bls_df.dropna(subset=["BLS_CPI"], inplace=True)

    log.info(
        f"BLS data ready: {len(bls_df)} rows  "
        f"[{bls_df.index[0].date()} → {bls_df.index[-1].date()}]"
    )
    return bls_df


def fetch_fred_gdp_data() -> pd.DataFrame:
    api_key = os.getenv('FRED_API_KEY')
    if not api_key:
        log.warning("FRED_API_KEY not set — skipping GDP data")
        return pd.DataFrame()

    fred = Fred(api_key=api_key)
    log.info("  FRED  A191RL1Q225SBEA  (Real GDP % change, quarterly SAAR)")

    gdp_quarterly = fred.get_series('A191RL1Q225SBEA').dropna()

    log.info(
        "GDP quarterly raw: %d quarters  [%s → %s]  last 4: %s",
        len(gdp_quarterly),
        gdp_quarterly.index[0].date(),
        gdp_quarterly.index[-1].date(),
        gdp_quarterly.tail(4).round(2).to_dict(),
    )

    # quarterly dates from FRED are already quarter-start (Jan 1, Apr 1, Jul 1, Oct 1)
    # resample to monthly and ffill so all 3 months of a quarter share the same value
    gdp_monthly = gdp_quarterly.resample('MS').ffill()
    gdp_df = gdp_monthly.to_frame(name='GDP_Growth')

    distinct = gdp_df['GDP_Growth'].nunique()
    log.info(
        "FRED GDP monthly: %d rows  [%s → %s]  distinct values: %d",
        len(gdp_df),
        gdp_df.index[0].date(),
        gdp_df.index[-1].date(),
        distinct,
    )
    if distinct < 5:
        log.warning("GDP has very few distinct values (%d) — data may be stale", distinct)
    return gdp_df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # yoy rates
    df["Inflation_Rate"] = df["Inflation"].pct_change(12) * 100
    df["Income_Growth"]  = df["Personal_Income"].pct_change(12) * 100

    # lag features (t-1)
    df["Claims_Lag1"]       = df["Weekly_Claims"].shift(1)
    df["Inflation_Lag1"]    = df["Inflation_Rate"].shift(1)
    df["Income_Lag1"]       = df["Income_Growth"].shift(1)
    df["Unemployment_Lag1"] = df["Unemployment"].shift(1)

    # first 12 months won't have yoy data yet
    df.dropna(subset=["Inflation_Rate", "Income_Growth"], inplace=True)

    # z-score (full-history mean/std)
    for col in ["Unemployment", "Weekly_Claims", "Income_Growth"]:
        df[f"{col}_Z"] = (df[col] - df[col].mean()) / df[col].std()

    log.info(
        f"Feature engineering complete: {len(df)} rows, "
        f"{len(df.columns)} columns"
    )
    return df


# db col → df col
_DB_COL_MAP = {
    "unemployment":    "Unemployment",
    "inflation_cpi":   "Inflation",
    "inflation_rate":  "Inflation_Rate",
    "weekly_claims":   "Weekly_Claims",
    "personal_income": "Personal_Income",
    "income_growth":   "Income_Growth",
    "gdp_growth":      "GDP_Growth",
}


def _to_float_or_none(val) -> float | None:
    try:
        f = float(val)
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return None


def write_to_db(df: pd.DataFrame, source: str = "FRED") -> int:
    from sqlalchemy import MetaData, func
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    rows = []
    for ts, row in df.iterrows():
        record: dict = {"date": ts.date(), "source": source}
        for db_col, df_col in _DB_COL_MAP.items():
            record[db_col] = _to_float_or_none(row.get(df_col))
        rows.append(record)

    if not rows:
        log.warning("No rows to write — aborting")
        return 0

    engine = get_engine()
    with engine.begin() as conn:
        meta = MetaData()
        meta.reflect(bind=engine, only=["economic_data"])
        table = meta.tables["economic_data"]

        stmt = pg_insert(table).values(rows)

        update_cols = {}
        for c in table.c:
            if c.name in ("id", "date", "source", "created_at"):
                continue
            if c.name == "gdp_growth":
                # Never clobber an existing GDP value with NULL.
                # If the incoming value is non-NULL use it (handles real revisions);
                # if it's NULL fall back to whatever is already in the DB.
                update_cols[c.name] = func.coalesce(stmt.excluded[c.name], c)
            else:
                update_cols[c.name] = stmt.excluded[c.name]

        stmt = stmt.on_conflict_do_update(
            index_elements=["date", "source"],
            set_=update_cols,
        )
        conn.execute(stmt)

    log.info(f"Upserted {len(rows)} rows  (source='{source}')")
    return len(rows)


def _upsert_gdp_only(gdp_monthly: pd.Series) -> int:
    """
    UPDATE economic_data SET gdp_growth = <value> WHERE date = <date>.

    Uses a plain UPDATE (not an upsert) so it ONLY touches the gdp_growth
    column and never modifies unemployment, inflation, or any other column.
    This is the authoritative GDP write path; the main write_to_db upsert
    is a secondary/fallback for newly-inserted rows.
    """
    from sqlalchemy import text
    engine = get_engine()
    updated = 0
    # forward-fill so months 2-3 of each quarter get the quarter's value
    gdp_filled = gdp_monthly.resample('MS').ffill()
    with engine.begin() as conn:
        for date, val in gdp_filled.items():
            if pd.isna(val):
                continue
            result = conn.execute(
                text("UPDATE economic_data SET gdp_growth = :v WHERE date = :d"),
                {"v": float(val), "d": date.date()},
            )
            updated += result.rowcount
    log.info("GDP-only UPDATE: %d rows updated", updated)
    return updated


def run_ingestion() -> pd.DataFrame:
    log.info("========== MacroMinds Data Ingestion ==========")

    log.info("--- Fetching FRED data ---")
    df_fred = fetch_fred_data()

    log.info("--- Fetching BLS data ---")
    df_bls = fetch_bls_data()

    log.info("--- Fetching FRED quarterly GDP data ---")
    df_gdp = fetch_fred_gdp_data()

    log.info("--- Engineering features ---")
    df = engineer_features(df_fred)

    if not df_bls.empty:
        df = df.join(df_bls, how="left")
        log.info("Merged BLS data")

    if not df_gdp.empty:
        df = df.join(df_gdp[["GDP_Growth"]], how="left")
        df["GDP_Growth"] = df["GDP_Growth"].ffill()
        log.info("Merged FRED quarterly GDP data")

    log.info(f"Final dataset: {len(df)} rows × {len(df.columns)} columns")

    log.info("--- Writing to PostgreSQL ---")
    n = write_to_db(df)

    # Dedicated GDP UPDATE — runs after the main upsert so it always wins.
    # This overwrites any stale value (World Bank annual, etc.) with the
    # correct FRED quarterly figure, touching ONLY the gdp_growth column.
    if not df_gdp.empty:
        log.info("--- Updating GDP-only (targeted UPDATE) ---")
        _upsert_gdp_only(df_gdp["GDP_Growth"])

    log.info(f"========== Ingestion complete: {n} rows written ==========")

    # Diagnostic: verify GDP has real variation in the DB
    try:
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            gdp_rows = conn.execute(text(
                "SELECT date, gdp_growth FROM economic_data "
                "WHERE gdp_growth IS NOT NULL "
                "ORDER BY date DESC LIMIT 8"
            )).fetchall()
        log.info("Last 8 GDP rows in DB (newest first):")
        for r in gdp_rows:
            log.info("  %s  →  %.4f", r[0], r[1])
        distinct = len(set(r[1] for r in gdp_rows))
        if distinct < 3:
            log.warning("GDP still looks flat — only %d distinct values in last 8 rows", distinct)
    except Exception as exc:
        log.warning("GDP diagnostic query failed: %s", exc)

    return df


if __name__ == "__main__":
    run_ingestion()
