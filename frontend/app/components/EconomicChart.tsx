import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import {
  metricOptions,
  type TimeSeriesDataPoint,
  type BacktestPoint,
  type ForecastPoint,
} from "@/app/services/api";
import { useState } from "react";

interface EconomicChartProps {
  selectedMetrics: string[];
  timePeriod: string;
  chartType: string;
  selectedYears: number[];
  historicalData: TimeSeriesDataPoint[];
  backtestData: BacktestPoint[];
  forecastData: ForecastPoint[];
  loading: boolean;
}

// Merged row — contains actual values + optional prediction keys
interface ChartRow {
  date: string;
  unemployment?: number | null;
  inflation?: number | null;
  gdpGrowth?: number | null;
  unemployment_pred?: number | null;
  inflation_pred?: number | null;
  isForecast?: boolean;
}

export function EconomicChart({
  selectedMetrics,
  timePeriod,
  chartType,
  selectedYears,
  historicalData,
  backtestData,
  forecastData,
  loading,
}: EconomicChartProps) {
  const [showPredictions, setShowPredictions] = useState(true);

  // Build the merged dataset
  const buildMergedData = (): { rows: ChartRow[]; nowLabel: string | null } => {
    // Step 1: filter historical by selected years
    let filtered = historicalData.filter((d) => selectedYears.includes(d.year!));

    // Step 2: apply time-period trimming on historical
    if (timePeriod === "6m") {
      filtered = filtered.slice(-6);
    } else if (timePeriod === "quarterly") {
      filtered = filtered.filter((_, i) => i % 3 === 0);
    } else if (timePeriod === "annually") {
      const yearly: typeof filtered = [];
      selectedYears.forEach((yr) => {
        const hit = filtered.find((d) => d.year === yr && d.month === "Dec");
        if (hit) yearly.push(hit);
      });
      filtered = yearly;
    } else if (timePeriod === "monthly") {
      filtered = filtered.slice(-12);
    }
    // "all" → keep everything

    // Build a lookup from backtestData by date string
    const backtestByDate: Record<string, BacktestPoint> = {};
    backtestData.forEach((b) => { backtestByDate[b.date] = b; });

    // Merge historical + backtest predictions
    const historicalRows: ChartRow[] = filtered.map((d) => {
      const bt = backtestByDate[d.date];
      return {
        date:              d.date,
        unemployment:      d.unemployment,
        inflation:         d.inflation,
        gdpGrowth:         d.gdpGrowth,
        unemployment_pred: bt?.predicted_unemployment ?? null,
        inflation_pred:    bt?.predicted_inflation    ?? null,
        isForecast:        false,
      };
    });

    const nowLabel = historicalRows.length > 0
      ? historicalRows[historicalRows.length - 1].date
      : null;

    // Append forecast rows
    const forecastRows: ChartRow[] = forecastData.map((f) => ({
      date:              f.date,
      unemployment:      null,
      inflation:         null,
      gdpGrowth:         null,
      unemployment_pred: f.predicted_unemployment,
      inflation_pred:    f.predicted_inflation,
      isForecast:        true,
    }));

    return { rows: [...historicalRows, ...forecastRows], nowLabel };
  };

  const { rows: chartData, nowLabel } = buildMergedData();

  const xAxisProps = {
    dataKey: "date",
    tick:    { fontSize: 11 },
    stroke:  "#6b7280",
  };

  const yAxisProps = {
    tick:   { fontSize: 12 },
    stroke: "#6b7280",
    label:  {
      value:    "Percentage (%)",
      angle:    -90,
      position: "insideLeft" as const,
      style:    { fontSize: 12 },
    },
  };

  const tooltipProps = {
    contentStyle: {
      backgroundColor: "white",
      border:          "1px solid #e5e7eb",
      borderRadius:    "8px",
      padding:         "12px",
    },
    formatter: (value: number | null) =>
      value != null ? `${value.toFixed(2)}%` : "—",
  };

  const legendProps = {
    wrapperStyle: { paddingTop: "20px" },
    iconType:     (chartType === "line" ? "line" : "rect") as any,
  };

  // Render solid actual lines + dashed prediction lines for a given chart type
  const renderLines = () => {
    const elements: React.ReactNode[] = [];

    selectedMetrics.forEach((metricKey) => {
      const metric = metricOptions.find((m) => m.value === metricKey);
      if (!metric) return;

      const solidProps = {
        key:         metricKey,
        dataKey:     metricKey,
        stroke:      metric.color,
        fill:        metric.color,
        name:        metric.label,
        connectNulls: false,
      };

      const predProps = metric.predKey
        ? {
            key:          `${metricKey}_pred`,
            dataKey:      metric.predKey,
            stroke:       metric.color,
            fill:         metric.color,
            name:         `${metric.label} (Model)`,
            connectNulls: false,
          }
        : null;

      if (chartType === "line") {
        elements.push(
          <Line
            {...solidProps}
            type="monotone"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        );
        if (showPredictions && predProps) {
          elements.push(
            <Line
              {...predProps}
              type="monotone"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4 }}
            />
          );
        }
      } else if (chartType === "bar") {
        elements.push(<Bar {...solidProps} />);
        if (showPredictions && predProps) {
          elements.push(<Bar {...predProps} fillOpacity={0.45} />);
        }
      } else {
        // area
        elements.push(
          <Area
            {...solidProps}
            type="monotone"
            strokeWidth={2}
            fillOpacity={0.15}
          />
        );
        if (showPredictions && predProps) {
          elements.push(
            <Area
              {...predProps}
              type="monotone"
              strokeWidth={2}
              strokeDasharray="5 3"
              fillOpacity={0.08}
            />
          );
        }
      }
    });

    return elements;
  };

  const renderChart = () => {
    const commonProps = { data: chartData };

    const nowLine = nowLabel ? (
      <ReferenceLine
        x={nowLabel}
        stroke="#6b7280"
        strokeDasharray="4 3"
        label={{ value: "Now", position: "top", fontSize: 11, fill: "#6b7280" }}
      />
    ) : null;

    if (chartType === "line") {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {nowLine}
          {renderLines()}
        </LineChart>
      );
    } else if (chartType === "bar") {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {nowLine}
          {renderLines()}
        </BarChart>
      );
    } else {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {nowLine}
          {renderLines()}
        </AreaChart>
      );
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Economic Trends</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="predictions-toggle"
            checked={showPredictions}
            onCheckedChange={setShowPredictions}
          />
          <Label
            htmlFor="predictions-toggle"
            className="text-sm cursor-pointer flex items-center gap-2"
          >
            Show AI Predictions
            <Badge
              variant="secondary"
              className="bg-purple-100 text-purple-700 border-purple-200"
            >
              Beta
            </Badge>
          </Label>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400 text-sm">Loading chart data…</div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          {renderChart()!}
        </ResponsiveContainer>
      )}
    </Card>
  );
}
