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
  ResponsiveContainer 
} from "recharts";
import { Card } from "@/app/components/ui/card";
import { historicalData, predictedData, metricOptions } from "@/app/data/economicData";
import { Badge } from "@/app/components/ui/badge";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { useState } from "react";

interface EconomicChartProps {
  selectedMetrics: string[];
  timePeriod: string;
  chartType: string;
  selectedYears: number[];
}

export function EconomicChart({ selectedMetrics, timePeriod, chartType, selectedYears }: EconomicChartProps) {
  const [showPredictions, setShowPredictions] = useState(true);

  // Filter data based on time period and selected years
  const getFilteredData = () => {
    // First filter by selected years
    let filtered = historicalData.filter((item) => 
      selectedYears.includes(item.year!)
    );
    
    // Then apply time period filter
    if (timePeriod === "6m") {
      filtered = filtered.slice(-6);
    } else if (timePeriod === "quarterly") {
      // Show only quarterly data (every 3 months)
      filtered = filtered.filter((_, index) => index % 3 === 0);
    } else if (timePeriod === "annually") {
      // Show only annual data (one data point per year)
      const yearlyData: typeof filtered = [];
      selectedYears.forEach(year => {
        const yearData = filtered.find(item => item.year === year && item.month === "Dec");
        if (yearData) yearlyData.push(yearData);
      });
      filtered = yearlyData;
    } else if (timePeriod === "monthly") {
      // Show last 12 months
      filtered = filtered.slice(-12);
    }
    // "all" shows all data for selected years
    
    // Add predictions if enabled
    if (showPredictions && selectedYears.includes(2025)) {
      return [...filtered, ...predictedData];
    }
    
    return filtered;
  };

  const filteredData = getFilteredData();

  // Render different chart types
  const renderChart = () => {
    const commonProps = {
      data: filteredData,
    };

    const xAxisProps = {
      dataKey: "date",
      tick: { fontSize: 12 },
      stroke: "#6b7280",
    };

    const yAxisProps = {
      tick: { fontSize: 12 },
      stroke: "#6b7280",
      label: { 
        value: 'Percentage (%)', 
        angle: -90, 
        position: 'insideLeft', 
        style: { fontSize: 12 } 
      },
    };

    const tooltipProps = {
      contentStyle: { 
        backgroundColor: 'white', 
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px'
      },
      formatter: (value: number) => `${value}%`,
    };

    const legendProps = {
      wrapperStyle: { paddingTop: '20px' },
      iconType: chartType === "line" ? "line" : "rect" as any,
    };

    const renderMetricElements = () => {
      return selectedMetrics.map((metricKey) => {
        const metric = metricOptions.find(m => m.value === metricKey);
        if (!metric) return null;

        const commonMetricProps = {
          key: metricKey,
          dataKey: metricKey,
          stroke: metric.color,
          fill: metric.color,
          name: metric.label,
        };

        if (chartType === "line") {
          return (
            <Line
              {...commonMetricProps}
              type="monotone"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={metric.color}
                    strokeWidth={payload.isPrediction ? 2 : 0}
                    stroke={payload.isPrediction ? "#fff" : "none"}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          );
        } else if (chartType === "bar") {
          return (
            <Bar
              {...commonMetricProps}
              fillOpacity={(props) => props.payload?.isPrediction ? 0.5 : 1}
            />
          );
        } else if (chartType === "area") {
          return (
            <Area
              {...commonMetricProps}
              type="monotone"
              fillOpacity={(props) => props.payload?.isPrediction ? 0.3 : 0.6}
              strokeWidth={2}
            />
          );
        }
        return null;
      });
    };

    if (chartType === "line") {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {renderMetricElements()}
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
          {renderMetricElements()}
        </BarChart>
      );
    } else if (chartType === "area") {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          <Legend {...legendProps} />
          {renderMetricElements()}
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
          <Label htmlFor="predictions-toggle" className="text-sm cursor-pointer flex items-center gap-2">
            Show AI Predictions
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
              Beta
            </Badge>
          </Label>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        {renderChart()}
      </ResponsiveContainer>
    </Card>
  );
}
