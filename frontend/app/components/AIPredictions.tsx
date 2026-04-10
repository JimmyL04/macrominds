import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Sparkles, TrendingUp, TrendingDown, Search, Info } from "lucide-react";
import { type ForecastPoint, type TimeSeriesDataPoint, MONTH_NAMES } from "@/app/services/api";
import { useState } from "react";

interface AIPredictionsProps {
  loading: boolean;
  unempCurrent: number | null;
  unempPredicted: number | null;
  inflationCurrent: number | null;
  inflationPredicted: number | null;
  gdpCurrent: number | null;
  gdpPredicted: number | null;
  gdpQuarter: string | null;
  forecastData: ForecastPoint[];
  forecastMonths: number;
  historicalData: TimeSeriesDataPoint[];
  onDateLookup: (date: string | null) => void;
}

interface PredictionRow {
  metric: string;
  currentValue: number | null;
  predictedValue: number | null;
  invertColors: boolean;
}

interface LookupResult {
  date: string;
  type: "historical" | "forecast";
  unemployment: number | null;
  inflation: number | null;
  gdpGrowth: number | null;
  unemployment_lower?: number | null;
  unemployment_upper?: number | null;
  inflation_lower?: number | null;
  inflation_upper?: number | null;
  gdp_lower?: number | null;
  gdp_upper?: number | null;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5">
      <Info className="size-3.5 text-gray-400 group-hover:text-gray-500 cursor-help transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-md bg-gray-800 px-2.5 py-2 text-xs text-white leading-relaxed text-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50 whitespace-normal">
        {text}
      </span>
    </span>
  );
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4,  jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateInput(input: string): string | null {
  const match = input.trim().match(/^([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const idx = MONTH_MAP[match[1].toLowerCase()];
  if (idx === undefined) return null;
  return `${MONTH_NAMES[idx]} ${match[2]}`;
}

export function AIPredictions({
  loading,
  unempCurrent,
  unempPredicted,
  inflationCurrent,
  inflationPredicted,
  gdpCurrent,
  gdpPredicted,
  gdpQuarter,
  forecastData,
  forecastMonths,
  historicalData,
  onDateLookup,
}: AIPredictionsProps) {
  const rows: PredictionRow[] = [
    {
      metric:         "Unemployment Rate",
      currentValue:   unempCurrent,
      predictedValue: unempPredicted,
      invertColors:   true,
    },
    {
      metric:         "Inflation Rate",
      currentValue:   inflationCurrent,
      predictedValue: inflationPredicted,
      invertColors:   true,
    },
  ];

  // Horizon table: indices 2 / 5 / 11 / 23 → 3mo / 6mo / 12mo / 24mo
  const horizons = [
    { label: "3 months",  index: 2,  minMonths: 0  },
    { label: "6 months",  index: 5,  minMonths: 0  },
    { label: "12 months", index: 11, minMonths: 0  },
    { label: "24 months", index: 23, minMonths: 24 },
  ];

  const hasHorizonData = forecastData.length > 0;

  // --- Date Lookup state ---
  const [lookupInput, setLookupInput]   = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError]   = useState<string | null>(null);

  const handleLookup = () => {
    setLookupError(null);
    setLookupResult(null);
    onDateLookup(null);

    const normalized = parseDateInput(lookupInput);
    if (!normalized) {
      setLookupError("Use the format Mon YYYY, e.g. Jun 2026");
      return;
    }

    // Search historical first
    const histMatch = historicalData.find((d) => d.date === normalized);
    if (histMatch) {
      setLookupResult({
        date:         normalized,
        type:         "historical",
        unemployment: histMatch.unemployment,
        inflation:    histMatch.inflation,
        gdpGrowth:    histMatch.gdpGrowth,
      });
      onDateLookup(normalized);
      return;
    }

    // Search forecast
    const forecastMatch = forecastData.find((f) => f.date === normalized);
    if (forecastMatch) {
      setLookupResult({
        date:               normalized,
        type:               "forecast",
        unemployment:       forecastMatch.predicted_unemployment,
        inflation:          forecastMatch.predicted_inflation,
        gdpGrowth:          forecastMatch.predicted_gdp ?? null,
        unemployment_lower: forecastMatch.predicted_unemployment_lower,
        unemployment_upper: forecastMatch.predicted_unemployment_upper,
        inflation_lower:    forecastMatch.predicted_inflation_lower,
        inflation_upper:    forecastMatch.predicted_inflation_upper,
        gdp_lower:          forecastMatch.predicted_gdp_lower ?? null,
        gdp_upper:          forecastMatch.predicted_gdp_upper ?? null,
      });
      onDateLookup(normalized);
      return;
    }

    // Out of range
    const earliest = historicalData[0]?.date ?? "unknown";
    const latest   = forecastData[forecastData.length - 1]?.date ?? "unknown";
    setLookupError(
      `No data for that date. Try a date between ${earliest} and ${latest}.`
    );
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLookup();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="size-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">AI Predictions</h3>
        <Badge
          variant="secondary"
          className="bg-purple-100 text-purple-700 border-purple-200"
        >
          Beta
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200 animate-pulse"
            >
              <div className="h-4 bg-gray-200 rounded w-40 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-64" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Next-month nowcast rows */}
          <div className="space-y-4">
            {rows.map((row) => {
              const hasData =
                row.currentValue != null && row.predictedValue != null;

              if (!hasData) {
                return (
                  <div
                    key={row.metric}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <p className="font-medium text-gray-900">{row.metric}</p>
                    <span className="text-sm text-gray-400">No prediction available</span>
                  </div>
                );
              }

              const current   = row.currentValue!;
              const predicted = row.predictedValue!;
              const change    = predicted - current;
              const pctChange = ((change / current) * 100).toFixed(1);
              const isGood = row.invertColors ? change < 0 : change > 0;

              return (
                <div
                  key={row.metric}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 mb-1">{row.metric}</p>
                    <p className="text-sm text-gray-600">
                      Current:{" "}
                      <span className="font-semibold">{current.toFixed(2)}%</span>
                      {" → "}
                      Predicted:{" "}
                      <span className="font-semibold">{predicted.toFixed(2)}%</span>
                    </p>
                    {(() => {
                      const pt6 = forecastData[5];
                      if (!pt6) return null;
                      const lower = row.metric === "Unemployment Rate"
                        ? pt6.predicted_unemployment_lower
                        : pt6.predicted_inflation_lower;
                      const upper = row.metric === "Unemployment Rate"
                        ? pt6.predicted_unemployment_upper
                        : pt6.predicted_inflation_upper;
                      if (lower == null || upper == null) return null;
                      return (
                        <p className="text-xs text-gray-400 mt-0.5">
                          6-month range:{" "}
                          <span className="font-medium text-gray-500">
                            {lower.toFixed(2)}% – {upper.toFixed(2)}%
                          </span>
                        </p>
                      );
                    })()}
                  </div>

                  <div className="text-right">
                    <div
                      className={`flex items-center gap-1 ${
                        isGood ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {change < 0 ? (
                        <TrendingDown className="size-4" />
                      ) : (
                        <TrendingUp className="size-4" />
                      )}
                      <span className="font-semibold text-sm">
                        {change > 0 ? "+" : ""}{pctChange}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Next month</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* GDP nowcast row */}
          {(() => {
            if (gdpCurrent == null && gdpPredicted == null) return (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-medium text-gray-900">GDP Growth</p>
                <span className="text-sm text-gray-400">No prediction available</span>
              </div>
            );
            const current   = gdpCurrent   ?? 0;
            const predicted = gdpPredicted ?? 0;
            const change    = predicted - current;
            const pctChange = current !== 0 ? ((change / Math.abs(current)) * 100).toFixed(1) : "—";
            const isGood    = change > 0;
            return (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">GDP Growth</p>
                  <p className="text-sm text-gray-600">
                    Current:{" "}
                    <span className="font-semibold">{current.toFixed(2)}%</span>
                    {" → "}
                    Predicted:{" "}
                    <span className="font-semibold">{predicted.toFixed(2)}%</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 ${isGood ? "text-green-600" : "text-red-600"}`}>
                    {change < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
                    <span className="font-semibold text-sm">
                      {change > 0 ? "+" : ""}{pctChange}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{gdpQuarter ?? "Next quarter"}</p>
                </div>
              </div>
            );
          })()}

          {/* Forecast horizon summary table */}
          {hasHorizonData && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Forecast Horizon
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-200">
                        Horizon
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700 border-r border-gray-200">
                        Date
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700 border-r border-gray-200">
                        Unemployment
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700 border-r border-gray-200">
                        Inflation
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-gray-700">
                        GDP Growth
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {horizons.filter(({ minMonths }) => forecastMonths >= minMonths).map(({ label, index }) => {
                      const point = forecastData[index];
                      return (
                        <tr
                          key={label}
                          className="border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-3 py-2 font-medium text-gray-800 border-r border-gray-200">
                            {label}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-500 border-r border-gray-200">
                            {point?.date ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-red-600 border-r border-gray-200">
                            {point ? `${point.predicted_unemployment.toFixed(2)}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-amber-600 border-r border-gray-200">
                            {point ? `${point.predicted_inflation.toFixed(2)}%` : "—"}
                          </td>
                          <td className="px-3 py-2 text-center font-semibold text-emerald-600">
                            {point?.predicted_gdp != null ? `${point.predicted_gdp.toFixed(2)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Date Lookup ── */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Search className="size-4 text-gray-500" />
              Date Lookup
              <InfoTooltip text="Type a month and year to pull up the exact rates for that date. Dates within the historical range show real data. Future dates show model estimates. The chart will mark that point with a blue line." />
            </h4>
            <div className="flex gap-2">
              <Input
                value={lookupInput}
                onChange={(e) => {
                  setLookupInput(e.target.value);
                  setLookupError(null);
                  setLookupResult(null);
                  onDateLookup(null);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="e.g. Jun 2026"
                className="max-w-[180px] text-sm"
              />
              <Button size="sm" onClick={handleLookup}>
                Look Up
              </Button>
            </div>

            {/* Inline error */}
            {lookupError && (
              <p className="mt-2 text-xs text-red-600">{lookupError}</p>
            )}

            {/* Result card */}
            {lookupResult && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-semibold text-gray-900 text-sm">
                    {lookupResult.date}
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      lookupResult.type === "historical"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }
                  >
                    {lookupResult.type === "historical" ? "Historical" : "Forecast (estimated)"}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Unemployment Rate</span>
                    <span className="font-semibold text-gray-900">
                      {lookupResult.unemployment != null
                        ? `${lookupResult.unemployment.toFixed(2)}%`
                        : "—"}
                    </span>
                  </div>
                  {lookupResult.type === "forecast" &&
                    lookupResult.unemployment_lower != null &&
                    lookupResult.unemployment_upper != null && (
                      <p className="text-xs text-gray-400 pl-0">
                        Range: {lookupResult.unemployment_lower.toFixed(2)}% – {lookupResult.unemployment_upper.toFixed(2)}%
                      </p>
                    )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Inflation Rate</span>
                    <span className="font-semibold text-gray-900">
                      {lookupResult.inflation != null
                        ? `${lookupResult.inflation.toFixed(2)}%`
                        : "—"}
                    </span>
                  </div>
                  {lookupResult.type === "forecast" &&
                    lookupResult.inflation_lower != null &&
                    lookupResult.inflation_upper != null && (
                      <p className="text-xs text-gray-400">
                        Range: {lookupResult.inflation_lower.toFixed(2)}% – {lookupResult.inflation_upper.toFixed(2)}%
                      </p>
                    )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">GDP Growth</span>
                    <span className="font-semibold text-gray-900">
                      {lookupResult.gdpGrowth != null
                        ? `${lookupResult.gdpGrowth.toFixed(2)}%`
                        : "—"}
                    </span>
                  </div>
                  {lookupResult.type === "forecast" &&
                    lookupResult.gdp_lower != null &&
                    lookupResult.gdp_upper != null && (
                      <p className="text-xs text-gray-400">
                        Range: {lookupResult.gdp_lower.toFixed(2)}% – {lookupResult.gdp_upper.toFixed(2)}%
                      </p>
                    )}
                </div>

                {lookupResult.type === "forecast" && (
                  <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                    Prophet model estimates. The further out the date, the less reliable the numbers.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── About the Models ── */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">About the Models</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* XGBoost card */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 text-sm">XGBoost: Current Nowcast</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                Active for next-month predictions
              </Badge>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              XGBoost (Extreme Gradient Boosting) combines hundreds of decision trees trained on
              macroeconomic features from FRED: initial jobless claims, CPI components, and income
              data. It works well for single-point predictions and achieves an RMSE of 0.1544 on
              held-out test data.
            </p>
            <p className="text-xs text-gray-500 font-medium">
              Used for: Unemployment &amp; Inflation next-month nowcast
            </p>
          </div>

          {/* Prophet card */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 text-sm">Prophet Forward Forecast</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                Active for 3-month to 2-year projections
              </Badge>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              Prophet is Meta's open-source time series model. It breaks a series into trend,
              seasonal, and uncertainty components. Unlike ARIMA, it doesn't converge to a flat
              mean over time. It handles seasonal patterns well and produces confidence intervals
              that grow wider the further out you forecast.
            </p>
            <p className="text-xs text-gray-500 font-medium">
              Used for: Unemployment &amp; Inflation multi-step forecast with confidence intervals
            </p>
          </div>

          {/* GDP Prophet card */}
          <div className="p-4 bg-white border border-gray-200 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-semibold text-gray-900 text-sm">Prophet GDP Forecast</span>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                Quarterly projections
              </Badge>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              A separate Prophet model trained on FRED quarterly Real GDP (SAAR % change, series
              A191RL1Q225SBEA). It uses an additive quarterly seasonality component and a
              changepoint prior to capture structural breaks. An XGBoost model provides the
              current-quarter nowcast using lagged macro features.
            </p>
            <p className="text-xs text-gray-500 font-medium">
              Used for: GDP Growth quarterly forecast and current-quarter nowcast
            </p>
          </div>

        </div>
      </div>
    </Card>
  );
}
