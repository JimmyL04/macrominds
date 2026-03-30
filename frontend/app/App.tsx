import { MetricCard } from "@/app/components/MetricCard";
import { EconomicChart } from "@/app/components/EconomicChart";
import { ChartControls } from "@/app/components/ChartControls";
import { AIPredictions } from "@/app/components/AIPredictions";
import {
  fetchHistoricalData,
  fetchPredictions,
  fetchBacktest,
  fetchForecast,
  type TimeSeriesDataPoint,
  type EconomicMetric,
  type PredictionsResponse,
  type BacktestPoint,
  type ForecastPoint,
} from "@/app/services/api";
import { BarChart3 } from "lucide-react";
import { useState, useEffect } from "react";

export default function App() {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "unemployment",
    "inflation",
    "gdpGrowth",
  ]);
  const [timePeriod, setTimePeriod]       = useState<string>("monthly");
  const [chartType, setChartType]         = useState<string>("line");
  const [selectedYears, setSelectedYears] = useState<number[]>([2022, 2023, 2024, 2025]);
  const [forecastMonths, setForecastMonths] = useState<number>(6);

  const [historicalData, setHistoricalData] = useState<TimeSeriesDataPoint[]>([]);
  const [predictions, setPredictions]       = useState<PredictionsResponse | null>(null);
  const [backtestData, setBacktestData]     = useState<BacktestPoint[]>([]);
  // forecastData: always 12 months — chart slices to forecastMonths, AIPredictions reads all 12
  const [forecastData, setForecastData]     = useState<ForecastPoint[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  // Initial load — fetch all data in parallel
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [hist, preds, backtest, forecast] = await Promise.all([
          fetchHistoricalData("2022-01-01"),
          fetchPredictions(),
          fetchBacktest("2022-01-01"),
          fetchForecast(12),  // always 12 months for the horizon table
        ]);
        setHistoricalData(hist);
        setPredictions(preds);
        setBacktestData(backtest);
        setForecastData(forecast);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Re-fetch forecast whenever the horizon selector changes.
  // We still fetch 12 months so the horizon table in AIPredictions always
  // has data at 3 / 6 / 12 months; the chart shows only the first forecastMonths.
  useEffect(() => {
    if (loading) return; // skip during the initial load (already fetching)
    fetchForecast(12)
      .then(setForecastData)
      .catch(() => { /* ignore refetch errors silently */ });
  }, [forecastMonths]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Derived MetricCard data from the two most recent historical rows
  // ---------------------------------------------------------------------------
  const currentMetrics: EconomicMetric[] = (() => {
    if (historicalData.length === 0) return [];

    const latest = historicalData[historicalData.length - 1];
    const prev   = historicalData[historicalData.length - 2] ?? latest;

    const unempVal  = latest.unemployment ?? 0;
    const inflatVal = latest.inflation    ?? 0;
    const gdpVal    = latest.gdpGrowth    ?? 0;

    const diff = (a: number, b: number) => parseFloat((a - b).toFixed(2));
    const trend = (v: number): "up" | "down" | "stable" =>
      v > 0 ? "up" : v < 0 ? "down" : "stable";

    return [
      {
        title:        "Unemployment Rate",
        value:        `${unempVal.toFixed(1)}%`,
        change:       diff(unempVal, prev.unemployment ?? unempVal),
        trend:        trend(diff(unempVal, prev.unemployment ?? unempVal)),
        invertColors: true,
      },
      {
        title:        "Inflation Rate",
        value:        `${inflatVal.toFixed(1)}%`,
        change:       diff(inflatVal, prev.inflation ?? inflatVal),
        trend:        trend(diff(inflatVal, prev.inflation ?? inflatVal)),
        invertColors: true,
      },
      {
        title:        "GDP Growth",
        value:        `${gdpVal.toFixed(1)}%`,
        change:       diff(gdpVal, prev.gdpGrowth ?? gdpVal),
        trend:        trend(diff(gdpVal, prev.gdpGrowth ?? gdpVal)),
        invertColors: false,
      },
    ];
  })();

  const latestRow = historicalData.length > 0
    ? historicalData[historicalData.length - 1]
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="size-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Economic Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Real-time economic indicators and AI-powered projections
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* Overview Metrics */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Indicators</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
                  <div className="h-8 bg-gray-200 rounded w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentMetrics.map((metric) => (
                <MetricCard
                  key={metric.title}
                  title={metric.title}
                  value={metric.value}
                  change={metric.change}
                  trend={metric.trend}
                  invertColors={metric.invertColors}
                />
              ))}
            </div>
          )}
        </section>

        {/* Charts Section */}
        <section>
          <ChartControls
            selectedMetrics={selectedMetrics}
            onMetricsChange={setSelectedMetrics}
            timePeriod={timePeriod}
            onTimePeriodChange={setTimePeriod}
            chartType={chartType}
            onChartTypeChange={setChartType}
            selectedYears={selectedYears}
            onYearsChange={setSelectedYears}
            forecastMonths={forecastMonths}
            onForecastMonthsChange={setForecastMonths}
          />
          <EconomicChart
            selectedMetrics={selectedMetrics}
            timePeriod={timePeriod}
            chartType={chartType}
            selectedYears={selectedYears}
            historicalData={historicalData}
            backtestData={backtestData}
            forecastData={forecastData.slice(0, forecastMonths)}
            loading={loading}
          />
        </section>

        {/* AI Predictions Section */}
        <section className="mt-8">
          <AIPredictions
            loading={loading}
            unempCurrent={latestRow?.unemployment ?? null}
            unempPredicted={predictions?.unemployment_prediction ?? null}
            inflationCurrent={latestRow?.inflation ?? null}
            inflationPredicted={predictions?.inflation_prediction ?? null}
            forecastData={forecastData}
          />
        </section>
      </main>
    </div>
  );
}
