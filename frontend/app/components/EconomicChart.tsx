import {
  ComposedChart,
  Line,
  Bar,
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
import { useState, type ReactNode } from "react";

interface EconomicChartProps {
  selectedMetrics: string[];
  timePeriod: string;
  chartType: string;
  selectedYears: number[];
  historicalData: TimeSeriesDataPoint[];
  backtestData: BacktestPoint[];
  forecastData: ForecastPoint[];
  loading: boolean;
  highlightDate?: string | null;
}

// merged row — actual values + optional prediction keys + Prophet confidence bands
interface ChartRow {
  date: string;
  unemployment?: number | null;
  inflation?: number | null;
  gdpGrowth?: number | null;
  unemployment_pred?: number | null;
  inflation_pred?: number | null;
  gdp_pred?: number | null;
  // stacked-area CI bands (forecast zone only — null in historical rows)
  unemployment_ci_lower?: number | null;
  unemployment_ci_band?:  number | null;  // upper - lower
  inflation_ci_lower?:    number | null;
  inflation_ci_band?:     number | null;  // upper - lower
  gdp_ci_lower?:          number | null;
  gdp_ci_band?:           number | null;  // upper - lower
  isForecast?: boolean;
}

// Internal dataKeys used only for rendering the CI bands — never shown in legend/tooltip
const BAND_KEYS = new Set([
  "unemployment_ci_lower", "unemployment_ci_band",
  "inflation_ci_lower",    "inflation_ci_band",
  "gdp_ci_lower",          "gdp_ci_band",
]);

// Config for the CI legend entries injected manually
const CI_META: Record<string, { label: string; fill: string }> = {
  unemployment: { label: "Unemployment Confidence Interval", fill: "rgba(239,68,68,0.30)" },
  inflation:    { label: "Inflation Confidence Interval",    fill: "rgba(245,158,11,0.30)" },
  gdpGrowth:    { label: "GDP Confidence Interval",          fill: "rgba(16,185,129,0.30)" },
};

export function EconomicChart({
  selectedMetrics,
  timePeriod,
  chartType,
  selectedYears,
  historicalData,
  backtestData,
  forecastData,
  loading,
  highlightDate,
}: EconomicChartProps) {
  const [showPredictions, setShowPredictions] = useState(true);

  const buildMergedData = (): { rows: ChartRow[]; nowLabel: string | null } => {
    // --- historical: filter by year then apply time-period thinning ---
    // "all" bypasses the year selector entirely so every loaded row is visible
    let filtered = timePeriod === "all"
      ? historicalData
      : historicalData.filter((d) => selectedYears.includes(d.year!));

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

    const backtestByDate: Record<string, BacktestPoint> = {};
    backtestData.forEach((b) => { backtestByDate[b.date] = b; });

    const historicalRows: ChartRow[] = filtered.map((d) => {
      const bt = backtestByDate[d.date];
      return {
        date:              d.date,
        unemployment:      d.unemployment,
        inflation:         d.inflation,
        gdpGrowth:         d.gdpGrowth,
        unemployment_pred: bt?.predicted_unemployment ?? null,
        inflation_pred:    bt?.predicted_inflation    ?? null,
        gdp_pred:          null,
        // keep band keys null so CI areas don't render in the historical zone
        unemployment_ci_lower: null,
        unemployment_ci_band:  null,
        inflation_ci_lower:    null,
        inflation_ci_band:     null,
        gdp_ci_lower:          null,
        gdp_ci_band:           null,
        isForecast: false,
      };
    });

    const nowLabel = historicalRows.length > 0
      ? historicalRows[historicalRows.length - 1].date
      : null;

    // --- forecast rows ---
    const allForecastRows: ChartRow[] = forecastData.map((f) => {
      const unempLower = f.predicted_unemployment_lower ?? null;
      const unempUpper = f.predicted_unemployment_upper ?? null;
      const infLower   = f.predicted_inflation_lower   ?? null;
      const infUpper   = f.predicted_inflation_upper   ?? null;
      const gdpLower   = f.predicted_gdp_lower         ?? null;
      const gdpUpper   = f.predicted_gdp_upper         ?? null;
      return {
        date:              f.date,
        unemployment:      null,
        inflation:         null,
        gdpGrowth:         null,
        unemployment_pred: f.predicted_unemployment,
        inflation_pred:    f.predicted_inflation,
        gdp_pred:          f.predicted_gdp ?? null,
        unemployment_ci_lower: unempLower,
        unemployment_ci_band:
          unempLower != null && unempUpper != null ? unempUpper - unempLower : null,
        inflation_ci_lower: infLower,
        inflation_ci_band:
          infLower != null && infUpper != null ? infUpper - infLower : null,
        gdp_ci_lower: gdpLower,
        gdp_ci_band:
          gdpLower != null && gdpUpper != null ? gdpUpper - gdpLower : null,
        isForecast: true,
      };
    });

    // Anchor CI bands to the "Now" point so shading starts exactly at the divider.
    // Without this the stacked <Area> only begins at the first forecast tick,
    // leaving a one-point gap between the "Now" line and the visible shading.
    if (historicalRows.length > 0 && allForecastRows.length > 0) {
      const first = allForecastRows[0];
      historicalRows[historicalRows.length - 1] = {
        ...historicalRows[historicalRows.length - 1],
        unemployment_ci_lower: first.unemployment_ci_lower,
        unemployment_ci_band:  first.unemployment_ci_band,
        inflation_ci_lower:    first.inflation_ci_lower,
        inflation_ci_band:     first.inflation_ci_band,
        gdp_ci_lower:          first.gdp_ci_lower,
        gdp_ci_band:           first.gdp_ci_band,
      };
    }

    let forecastRows = (() => {
      if (timePeriod === "quarterly") return allForecastRows.filter((_, i) => (i + 1) % 3 === 0);
      if (timePeriod === "6m")        return allForecastRows.filter((_, i) => (i + 1) % 6 === 0);
      if (timePeriod === "annually")  return allForecastRows.filter((_, i) => (i + 1) % 12 === 0);
      return allForecastRows;
    })();

    // If the highlight date is a forecast point that got filtered out by time-period
    // thinning, inject it back so Recharts has a matching x-axis tick to anchor the
    // ReferenceLine against. Without this the line silently disappears.
    if (highlightDate) {
      const inForecast  = forecastData.some((f) => f.date === highlightDate);
      const inRows      = forecastRows.some((r) => r.date === highlightDate);
      if (inForecast && !inRows) {
        const fp = forecastData.find((f) => f.date === highlightDate)!;
        const ul = fp.predicted_unemployment_lower ?? null;
        const uu = fp.predicted_unemployment_upper ?? null;
        const il = fp.predicted_inflation_lower    ?? null;
        const iu = fp.predicted_inflation_upper    ?? null;
        const gl = fp.predicted_gdp_lower          ?? null;
        const gu = fp.predicted_gdp_upper          ?? null;
        const injected: ChartRow = {
          date:              fp.date,
          unemployment:      null,
          inflation:         null,
          gdpGrowth:         null,
          unemployment_pred: fp.predicted_unemployment,
          inflation_pred:    fp.predicted_inflation,
          gdp_pred:          fp.predicted_gdp ?? null,
          unemployment_ci_lower: ul,
          unemployment_ci_band:  ul != null && uu != null ? uu - ul : null,
          inflation_ci_lower:    il,
          inflation_ci_band:     il != null && iu != null ? iu - il : null,
          gdp_ci_lower:          gl,
          gdp_ci_band:           gl != null && gu != null ? gu - gl : null,
          isForecast: true,
        };
        // Insert in chronological order using the source forecastData index as key
        const fcstDates  = forecastData.map((f) => f.date);
        const targetIdx  = fcstDates.indexOf(highlightDate);
        let insertPos    = forecastRows.length;
        for (let i = 0; i < forecastRows.length; i++) {
          if (fcstDates.indexOf(forecastRows[i].date) > targetIdx) {
            insertPos = i;
            break;
          }
        }
        forecastRows = [
          ...forecastRows.slice(0, insertPos),
          injected,
          ...forecastRows.slice(insertPos),
        ];
      }
    }

    return { rows: [...historicalRows, ...forecastRows], nowLabel };
  };

  const { rows: chartData, nowLabel } = buildMergedData();

  // Fully custom tooltip — shows CI range as a sub-line below the model prediction
  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    // The raw ChartRow for this point lives on any payload item's .payload
    const row: ChartRow = payload[0]?.payload ?? {};

    // Entries the user should actually see (no band internals, no null values)
    const visible = (payload as any[]).filter(
      (p) => !BAND_KEYS.has(p.dataKey) && p.value != null
    );
    if (!visible.length) return null;

    return (
      <div style={{
        backgroundColor: "white",
        border:          "1px solid #e5e7eb",
        borderRadius:    8,
        padding:         "10px 12px",
        fontSize:        12,
        minWidth:        210,
      }}>
        <p style={{ fontWeight: 600, marginBottom: 8, color: "#111827", fontSize: 13 }}>
          {label}
        </p>
        {visible.map((entry: any) => {
          // For model prediction lines, pull CI bounds straight from the ChartRow
          let ciLower: number | null = null;
          let ciUpper: number | null = null;
          if (entry.dataKey === "unemployment_pred") {
            ciLower = row.unemployment_ci_lower ?? null;
            ciUpper = ciLower != null && row.unemployment_ci_band != null
              ? ciLower + row.unemployment_ci_band : null;
          } else if (entry.dataKey === "inflation_pred") {
            ciLower = row.inflation_ci_lower ?? null;
            ciUpper = ciLower != null && row.inflation_ci_band != null
              ? ciLower + row.inflation_ci_band : null;
          } else if (entry.dataKey === "gdp_pred") {
            ciLower = row.gdp_ci_lower ?? null;
            ciUpper = ciLower != null && row.gdp_ci_band != null
              ? ciLower + row.gdp_ci_band : null;
          }

          return (
            <div key={entry.dataKey} style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  backgroundColor: entry.color, flexShrink: 0,
                }} />
                <span style={{ color: "#374151" }}>
                  {entry.name}:{" "}
                  <strong>{(entry.value as number).toFixed(2)}%</strong>
                </span>
              </div>
              {ciLower != null && ciUpper != null && (
                <p style={{
                  color: "#9ca3af", marginLeft: 14, marginTop: 2, fontSize: 11,
                }}>
                  Confidence Range: {ciLower.toFixed(2)}% – {ciUpper.toFixed(2)}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Custom legend — filters out internal band series, injects CI legend entries
  const legendContent = ({ payload }: any) => {
    const visible = ((payload as any[]) ?? []).filter(
      (p) => !BAND_KEYS.has(p.dataKey)
    );

    const ciEntries: Array<{ key: string; label: string; fill: string }> = [];
    if (showPredictions) {
      for (const mk of selectedMetrics) {
        if (CI_META[mk]) ciEntries.push({ key: `ci_${mk}`, ...CI_META[mk] });
      }
    }

    if (!visible.length && !ciEntries.length) return null;

    return (
      <ul style={{
        display: "flex", flexWrap: "wrap", gap: "8px 20px",
        paddingTop: 16, margin: 0, listStyle: "none",
      }}>
        {visible.map((p: any) => (
          <li key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
            {chartType === "line" ? (
              <span style={{ display: "inline-block", width: 16, height: 2, backgroundColor: p.color, flexShrink: 0 }} />
            ) : (
              <span style={{ display: "inline-block", width: 12, height: 12, backgroundColor: p.color, flexShrink: 0 }} />
            )}
            {p.value}
          </li>
        ))}
        {ciEntries.map((ci) => (
          <li key={ci.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
            <span style={{
              display: "inline-block", width: 12, height: 12,
              backgroundColor: ci.fill,
              border: "1px solid rgba(0,0,0,0.12)",
              flexShrink: 0,
            }} />
            {ci.label}
          </li>
        ))}
      </ul>
    );
  };

  const renderLines = () => {
    // CI bands rendered first so they sit behind the data lines
    const bandElements: ReactNode[] = [];
    const metricElements: ReactNode[] = [];

    // CI bands render in all chart types (area mode uses slightly higher opacity
    // so the shading stays distinguishable from the metric fill areas below it)
    const bandFillOpacity = chartType === "area" ? 0.20 : 0.13;

    if (showPredictions) {
      if (selectedMetrics.includes("unemployment")) {
        bandElements.push(
          <Area
            key="unemp_ci_base"
            dataKey="unemployment_ci_lower"
            stackId="ci_unemp"
            fill="transparent"
            stroke="none"
            legendType="none"
            connectNulls={false}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />,
          <Area
            key="unemp_ci_band"
            dataKey="unemployment_ci_band"
            stackId="ci_unemp"
            fill={`rgba(239,68,68,${bandFillOpacity})`}
            stroke="none"
            legendType="none"
            connectNulls={false}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        );
      }
      if (selectedMetrics.includes("inflation")) {
        bandElements.push(
          <Area
            key="inf_ci_base"
            dataKey="inflation_ci_lower"
            stackId="ci_inf"
            fill="transparent"
            stroke="none"
            legendType="none"
            connectNulls={false}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />,
          <Area
            key="inf_ci_band"
            dataKey="inflation_ci_band"
            stackId="ci_inf"
            fill={`rgba(245,158,11,${bandFillOpacity})`}
            stroke="none"
            legendType="none"
            connectNulls={false}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        );
      }
      if (selectedMetrics.includes("gdpGrowth")) {
        bandElements.push(
          <Area
            key="gdp_ci_base"
            dataKey="gdp_ci_lower"
            stackId="ci_gdp"
            fill="transparent"
            stroke="none"
            legendType="none"
            connectNulls={false}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />,
          <Area
            key="gdp_ci_band"
            dataKey="gdp_ci_band"
            stackId="ci_gdp"
            fill={`rgba(16,185,129,${bandFillOpacity})`}
            stroke="none"
            legendType="none"
            connectNulls={false}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        );
      }
    }

    selectedMetrics.forEach((metricKey) => {
      const metric = metricOptions.find((m) => m.value === metricKey);
      if (!metric) return;

      const solidProps = {
        key:          metricKey,
        dataKey:      metricKey,
        stroke:       metric.color,
        fill:         metric.color,
        name:         metric.label,
        connectNulls: false,
      };

      // connectNulls: true so the pred line bridges backtest → "Now" → forecast
      const predProps = metric.predKey
        ? {
            key:          `${metricKey}_pred`,
            dataKey:      metric.predKey,
            stroke:       metric.color,
            fill:         metric.color,
            name:         `${metric.label} (Model)`,
            connectNulls: true,
          }
        : null;

      if (chartType === "line") {
        metricElements.push(
          <Line {...solidProps} type="monotone" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        );
        if (showPredictions && predProps) {
          metricElements.push(
            <Line {...predProps} type="monotone" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
          );
        }
      } else if (chartType === "bar") {
        metricElements.push(<Bar {...solidProps} />);
        if (showPredictions && predProps) {
          // dashed Line overlay rather than a Bar — keeps the prediction readable
          // as a continuous trend line rather than competing discrete bars
          metricElements.push(
            <Line {...predProps} type="monotone" strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
          );
        }
      } else {
        metricElements.push(
          <Area {...solidProps} type="monotone" strokeWidth={2} fillOpacity={0.15} />
        );
        if (showPredictions && predProps) {
          metricElements.push(
            <Area {...predProps} type="monotone" strokeWidth={2} strokeDasharray="5 3" fillOpacity={0.08} />
          );
        }
      }
    });

    return [...bandElements, ...metricElements];
  };

  const nowLine = nowLabel ? (
    <ReferenceLine
      x={nowLabel}
      stroke="#6b7280"
      strokeDasharray="4 3"
      label={{ value: "Now", position: "top", fontSize: 11, fill: "#6b7280" }}
    />
  ) : null;

  // Look up values for the highlighted date directly from raw props (not filtered chartData)
  // so the pinned tooltip always has data regardless of the current time-period filter.
  const highlightValues = highlightDate ? (() => {
    const h = historicalData.find((d) => d.date === highlightDate);
    if (h) return {
      type:      "historical" as const,
      unemp:     h.unemployment,
      inflation: h.inflation,
      gdp:       h.gdpGrowth,
    };
    const f = forecastData.find((f) => f.date === highlightDate);
    if (f) return {
      type:      "forecast" as const,
      unemp:     f.predicted_unemployment,
      inflation: f.predicted_inflation,
      gdp:       f.predicted_gdp ?? null,
    };
    return null;
  })() : null;

  // Custom SVG tooltip box pinned to the top of the highlight reference line
  const HighlightLabel = (props: any) => {
    const { viewBox } = props;
    if (!viewBox || !highlightValues) return null;
    const { x, y } = viewBox as { x: number; y: number };

    const lines: Array<{ text: string; color: string }> = [];
    if (highlightValues.unemp != null)
      lines.push({ text: `Unemployment: ${highlightValues.unemp.toFixed(2)}%`, color: "#ef4444" });
    if (highlightValues.inflation != null)
      lines.push({ text: `Inflation: ${highlightValues.inflation.toFixed(2)}%`, color: "#d97706" });
    if (highlightValues.gdp != null)
      lines.push({ text: `GDP Growth: ${highlightValues.gdp.toFixed(2)}%`, color: "#10b981" });

    const pad     = 8;
    const lineH   = 15;
    const bWidth  = 182;
    const bHeight = pad * 2 + lineH * (lines.length + 1);
    // Dot sits right at the top of the chart area; box floats below it
    const dotY  = y + 2;
    const boxY  = dotY + 10;
    const boxX  = x - bWidth / 2;
    const isFC  = highlightValues.type === "forecast";

    return (
      <g>
        {/* vertical dot marker */}
        <circle cx={x} cy={dotY} r={5} fill="#6366f1" stroke="white" strokeWidth={2} />
        {/* tooltip box */}
        <rect
          x={boxX} y={boxY}
          width={bWidth} height={bHeight}
          rx={4}
          fill="white"
          stroke={isFC ? "#c7d2fe" : "#a7f3d0"}
          strokeWidth={1.5}
        />
        {/* type badge text */}
        <text
          x={boxX + pad} y={boxY + pad + lineH * 0.75}
          fontSize={10} fontWeight={700}
          fill={isFC ? "#4f46e5" : "#059669"}
        >
          {isFC ? "Forecast" : "Historical"}
        </text>
        {/* metric lines */}
        {lines.map((line, i) => (
          <text
            key={i}
            x={boxX + pad}
            y={boxY + pad + lineH * (i + 1.85)}
            fontSize={11}
            fill={line.color}
          >
            {line.text}
          </text>
        ))}
      </g>
    );
  };

  const highlightLine = highlightDate ? (
    <ReferenceLine
      x={highlightDate}
      stroke="#6366f1"
      strokeWidth={2}
      strokeDasharray="3 2"
      label={<HighlightLabel />}
    />
  ) : null;

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
          {/* ComposedChart lets <Area> CI bands coexist with Line and Bar series */}
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#6b7280" />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="#6b7280"
              label={{ value: "Percentage (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
            />
            <Tooltip content={customTooltip} />
            <Legend content={legendContent} />
            {nowLine}
            {highlightLine}
            {renderLines()}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
