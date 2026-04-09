// typed fetch wrappers for the Flask backend

const BASE_URL = "http://localhost:5001";

export interface PredictionsResponse {
  date: string | null;
  unemployment_prediction: number;
  inflation_prediction: number;
  features_used: Record<string, number>;
}

export interface HistoricalRow {
  date: string;
  unemployment: number | null;
  inflation_cpi: number | null;
  inflation_rate: number | null;
  weekly_claims: number | null;
  personal_income: number | null;
  income_growth: number | null;
  gdp_growth: number | null;
}

export interface HistoricalResponse {
  count: number;
  data: HistoricalRow[];
}

export interface SimulationResponse {
  inputs: {
    claims: number;
    inflation: number;
    income: number;
    prev_unemployment: number;
  };
  features: Record<string, number>;
  unemployment_prediction: number;
  inflation_prediction: number;
}

export interface BacktestPoint {
  date: string;       // "Jan 2023" after transform
  actual_unemployment: number | null;
  predicted_unemployment: number | null;
  actual_inflation: number | null;
  predicted_inflation: number | null;
}

export interface ForecastPoint {
  date: string;       // "Apr 2026", already formatted by backend
  predicted_unemployment: number;
  predicted_unemployment_lower: number;
  predicted_unemployment_upper: number;
  predicted_inflation: number;
  predicted_inflation_lower: number;
  predicted_inflation_upper: number;
}

export interface TimeSeriesDataPoint {
  date: string;             // "Jan 2022"
  unemployment: number | null;
  inflation: number | null; // mapped from inflation_rate
  gdpGrowth: number | null; // mapped from gdp_growth
  year?: number;
  month?: string;
}

export interface EconomicMetric {
  title: string;
  value: string;
  change: number;
  trend: "up" | "down" | "stable";
  invertColors?: boolean;
}

// predKey = recharts dataKey for the dashed prediction line
export const metricOptions = [
  { value: "unemployment", label: "Unemployment Rate", color: "#ef4444", predKey: "unemployment_pred" as string | null },
  { value: "inflation",    label: "Inflation Rate",    color: "#f59e0b", predKey: "inflation_pred"    as string | null },
  { value: "gdpGrowth",   label: "GDP Growth",        color: "#10b981", predKey: null },
];

export const chartTypeOptions = [
  { value: "line", label: "Line Chart" },
  { value: "bar",  label: "Bar Chart"  },
  { value: "area", label: "Area Chart" },
];

// generates [startYear, ..., currentYear] — updates automatically each calendar year
export function getAvailableYears(startYear = 2022): number[] {
  const end = new Date().getFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= end; y++) years.push(y);
  return years;
}

export const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

export function transformHistoricalData(rows: HistoricalRow[]): TimeSeriesDataPoint[] {
  return rows.map((row) => {
    const d     = new Date(row.date);
    const month = MONTH_NAMES[d.getUTCMonth()];
    const year  = d.getUTCFullYear();
    return {
      date:         `${month} ${year}`,
      unemployment: row.unemployment,
      inflation:    row.inflation_rate,
      gdpGrowth:    row.gdp_growth,
      year,
      month,
    };
  });
}

export interface RefreshResponse {
  status: "success" | "error";
  last_updated: string | null;
  new_records: number;
  message?: string;
}

// POST /api/refresh — triggers ingestion pipeline
export async function fetchApiRefresh(): Promise<RefreshResponse> {
  const res = await fetch(`${BASE_URL}/api/refresh`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `refresh request failed (${res.status})`);
  }
  return res.json();
}

// GET /api/predictions
export async function fetchPredictions(): Promise<PredictionsResponse> {
  const res = await fetch(`${BASE_URL}/api/predictions`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `predictions request failed (${res.status})`);
  }
  return res.json();
}

// GET /api/historical
export async function fetchHistoricalData(
  startDate?: string,
  endDate?: string,
): Promise<TimeSeriesDataPoint[]> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate)   params.set("end_date",   endDate);

  const url = `${BASE_URL}/api/historical${params.size ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `historical request failed (${res.status})`);
  }
  const json: HistoricalResponse = await res.json();
  return transformHistoricalData(json.data);
}

// GET /api/simulate
export async function fetchSimulation(
  claims: number,
  inflation: number,
  income: number,
  prevUnemployment: number,
): Promise<SimulationResponse> {
  const params = new URLSearchParams({
    claims:            String(claims),
    inflation:         String(inflation),
    income:            String(income),
    prev_unemployment: String(prevUnemployment),
  });
  const res = await fetch(`${BASE_URL}/api/simulate?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `simulate request failed (${res.status})`);
  }
  return res.json();
}

// GET /api/backtest — transforms YYYY-MM-DD dates to "Mon YYYY" for chart alignment
export async function fetchBacktest(startDate?: string): Promise<BacktestPoint[]> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);

  const url = `${BASE_URL}/api/backtest${params.size ? `?${params}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `backtest request failed (${res.status})`);
  }
  const json = await res.json();
  return (json.data as any[]).map((row) => {
    const d     = new Date(row.date);
    const month = MONTH_NAMES[d.getUTCMonth()];
    const year  = d.getUTCFullYear();
    return { ...row, date: `${month} ${year}` } as BacktestPoint;
  });
}

// GET /api/forecast
export async function fetchForecast(months: number): Promise<ForecastPoint[]> {
  const res = await fetch(`${BASE_URL}/api/forecast?months=${months}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `forecast request failed (${res.status})`);
  }
  const json = await res.json();
  return json.data as ForecastPoint[];
}
