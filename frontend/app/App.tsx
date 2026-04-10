import { MetricCard } from "@/app/components/MetricCard";
import { EconomicChart } from "@/app/components/EconomicChart";
import { ChartControls } from "@/app/components/ChartControls";
import { AIPredictions } from "@/app/components/AIPredictions";
import { HowToUseModal } from "@/app/components/HowToUseModal";
import { Button } from "@/app/components/ui/button";
import {
  fetchHistoricalData,
  fetchPredictions,
  fetchBacktest,
  fetchForecast,
  fetchApiRefresh,
  getAvailableYears,
  type TimeSeriesDataPoint,
  type EconomicMetric,
  type PredictionsResponse,
  type BacktestPoint,
  type ForecastPoint,
} from "@/app/services/api";
import { BarChart3, RefreshCw, Loader2, HelpCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function App() {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "unemployment",
    "inflation",
    "gdpGrowth",
  ]);
  const [timePeriod, setTimePeriod]         = useState<string>("monthly");
  const [chartType, setChartType]           = useState<string>("line");
  const [availableYears, setAvailableYears] = useState<number[]>(getAvailableYears);
  const [selectedYears, setSelectedYears]   = useState<number[]>(getAvailableYears);
  const [forecastMonths, setForecastMonths] = useState<number>(6);

  const [historicalData, setHistoricalData] = useState<TimeSeriesDataPoint[]>([]);
  const [predictions, setPredictions]       = useState<PredictionsResponse | null>(null);
  const [backtestData, setBacktestData]     = useState<BacktestPoint[]>([]);
  // always fetch 24mo; chart slices to forecastMonths, AIPredictions reads all 24
  const [forecastData, setForecastData]     = useState<ForecastPoint[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]       = useState<Date | null>(null);
  const [highlightDate, setHighlightDate]   = useState<string | null>(null);
  const highlightTimerRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHowToUse, setShowHowToUse]     = useState(false);

  // fetch all data in parallel on mount — fetchApiRefresh is NOT called here,
  // only when the user explicitly clicks "Refresh Data"
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [hist, preds, backtest, forecast] = await Promise.all([
          fetchHistoricalData("2022-01-01"),
          fetchPredictions(),
          fetchBacktest("2022-01-01"),
          fetchForecast(24),
        ]);
        setHistoricalData(hist);
        setPredictions(preds);
        setBacktestData(backtest);
        setForecastData(forecast);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      await fetchApiRefresh();
      const [hist, preds, backtest, forecast] = await Promise.all([
        fetchHistoricalData("2022-01-01"),
        fetchPredictions(),
        fetchBacktest("2022-01-01"),
        fetchForecast(24),
      ]);
      setHistoricalData(hist);
      setPredictions(preds);
      setBacktestData(backtest);
      setForecastData(forecast);
      setLastUpdated(new Date());

      // auto-add and auto-select any years that appeared in the fresh data
      const dataYears = [...new Set(hist.map((d) => d.year!))].sort();
      setAvailableYears((prev) => {
        const merged = [...new Set([...prev, ...dataYears])].sort();
        return merged;
      });
      setSelectedYears((prev) => {
        const newYears = dataYears.filter((y) => !prev.includes(y));
        return newYears.length > 0 ? [...prev, ...newYears].sort() : prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDateLookup = (date: string | null) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightDate(date);
    if (date) {
      highlightTimerRef.current = setTimeout(() => setHighlightDate(null), 5000);
    }
  };

  // build metric cards from last 2 historical rows
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

    // GDP is annual World Bank data — consecutive months share the same forward-filled
    // value, so prev.gdpGrowth === gdpVal and the naive diff is always 0.
    // Scan backwards for the most recent row with a DIFFERENT GDP value (prior year).
    const gdpPrevRow = historicalData
      .slice(0, historicalData.length - 1)
      .reverse()
      .find((d) => d.gdpGrowth != null && d.gdpGrowth !== gdpVal);
    const gdpPrevVal = gdpPrevRow?.gdpGrowth ?? gdpVal;

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
        change:       diff(gdpVal, gdpPrevVal),
        trend:        trend(diff(gdpVal, gdpPrevVal)),
        invertColors: false,
      },
    ];
  })();

  const latestRow = historicalData.length > 0
    ? historicalData[historicalData.length - 1]
    : null;

  const formatTimestamp = (d: Date) =>
    d.toLocaleString("en-US", {
      month: "short",
      day:   "numeric",
      year:  "numeric",
      hour:  "numeric",
      minute: "2-digit",
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {showHowToUse && <HowToUseModal onClose={() => setShowHowToUse(false)} />}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BarChart3 className="size-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Economic Dashboard</h1>
                <p className="text-sm text-gray-600 mt-1">
                  Economic data and forecasts from FRED and BLS
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHowToUse(true)}
              className="gap-1.5 text-gray-600 hover:text-gray-800 shrink-0"
            >
              <HelpCircle className="size-4" />
              How to Use
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Key Indicators</h2>
            <div className="flex items-center gap-3">
              {lastUpdated && !refreshing && (
                <span className="text-xs text-gray-400 hidden sm:block">
                  Updated {formatTimestamp(lastUpdated)}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="gap-1.5 text-gray-600 hover:text-gray-800"
              >
                {refreshing
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <RefreshCw className="size-3.5" />
                }
                {refreshing ? "Refreshing…" : "Refresh Data"}
              </Button>
            </div>
          </div>

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

        <section>
          <ChartControls
            selectedMetrics={selectedMetrics}
            onMetricsChange={setSelectedMetrics}
            timePeriod={timePeriod}
            onTimePeriodChange={setTimePeriod}
            chartType={chartType}
            onChartTypeChange={setChartType}
            availableYears={availableYears}
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
            highlightDate={highlightDate}
          />
        </section>

        <section className="mt-8">
          <AIPredictions
            loading={loading}
            unempCurrent={latestRow?.unemployment ?? null}
            unempPredicted={predictions?.unemployment_prediction ?? null}
            inflationCurrent={latestRow?.inflation ?? null}
            inflationPredicted={predictions?.inflation_prediction ?? null}
            gdpCurrent={latestRow?.gdpGrowth ?? null}
            gdpPredicted={predictions?.gdp_prediction ?? null}
            gdpQuarter={predictions?.gdp_quarter ?? null}
            forecastData={forecastData}
            forecastMonths={forecastMonths}
            historicalData={historicalData}
            onDateLookup={handleDateLookup}
          />
        </section>
      </main>
    </div>
  );
}
