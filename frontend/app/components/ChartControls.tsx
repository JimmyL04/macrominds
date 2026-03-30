import { Card } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { metricOptions, chartTypeOptions, availableYears } from "@/app/services/api";
import { BarChart3, LineChart, AreaChart } from "lucide-react";

interface ChartControlsProps {
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  timePeriod: string;
  onTimePeriodChange: (period: string) => void;
  chartType: string;
  onChartTypeChange: (type: string) => void;
  selectedYears: number[];
  onYearsChange: (years: number[]) => void;
  forecastMonths: number;
  onForecastMonthsChange: (months: number) => void;
}

export function ChartControls({
  selectedMetrics,
  onMetricsChange,
  timePeriod,
  onTimePeriodChange,
  chartType,
  onChartTypeChange,
  selectedYears,
  onYearsChange,
  forecastMonths,
  onForecastMonthsChange,
}: ChartControlsProps) {
  const handleMetricToggle = (metricValue: string) => {
    if (selectedMetrics.includes(metricValue)) {
      onMetricsChange(selectedMetrics.filter((m) => m !== metricValue));
    } else {
      onMetricsChange([...selectedMetrics, metricValue]);
    }
  };

  const handleYearToggle = (year: number) => {
    if (selectedYears.includes(year)) {
      onYearsChange(selectedYears.filter((y) => y !== year));
    } else {
      onYearsChange([...selectedYears, year].sort());
    }
  };

  const timePeriods = [
    { value: "monthly",   label: "Monthly"   },
    { value: "quarterly", label: "Quarterly" },
    { value: "6m",        label: "6 Months"  },
    { value: "annually",  label: "Annually"  },
    { value: "all",       label: "All Time"  },
  ];

  const forecastOptions = [
    { value: 3,  label: "3 months"  },
    { value: 6,  label: "6 months"  },
    { value: 12, label: "12 months" },
  ];

  const getChartIcon = (type: string) => {
    switch (type) {
      case "line": return <LineChart className="size-4" />;
      case "bar":  return <BarChart3 className="size-4" />;
      case "area": return <AreaChart className="size-4" />;
      default:     return <LineChart className="size-4" />;
    }
  };

  return (
    <Card className="p-6 mb-6">
      <div className="space-y-6">
        {/* Row 1: Metrics + Chart Type */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Metric Selection */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Metrics</h3>
            <div className="flex flex-wrap gap-4">
              {metricOptions.map((metric) => (
                <div key={metric.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={metric.value}
                    checked={selectedMetrics.includes(metric.value)}
                    onCheckedChange={() => handleMetricToggle(metric.value)}
                  />
                  <Label
                    htmlFor={metric.value}
                    className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                  >
                    <span
                      className="inline-block size-3 rounded-full"
                      style={{ backgroundColor: metric.color }}
                    />
                    {metric.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Chart Type */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Chart Type</h3>
            <div className="flex gap-2">
              {chartTypeOptions.map((type) => (
                <Button
                  key={type.value}
                  variant={chartType === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChartTypeChange(type.value)}
                  className="gap-2"
                >
                  {getChartIcon(type.value)}
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Time Period + Year Selection */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          {/* Time Period */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Time Period</h3>
            <div className="flex flex-wrap gap-2">
              {timePeriods.map((period) => (
                <Button
                  key={period.value}
                  variant={timePeriod === period.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTimePeriodChange(period.value)}
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Year Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Years</h3>
            <div className="flex flex-wrap gap-2">
              {availableYears.map((year) => (
                <Button
                  key={year}
                  variant={selectedYears.includes(year) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleYearToggle(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Forecast Horizon */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900 shrink-0">Forecast Horizon</h3>
            <div className="flex gap-2">
              {forecastOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={forecastMonths === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => onForecastMonthsChange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-gray-400 sm:ml-2">
              Controls how far the dashed forecast lines extend beyond "Now"
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
