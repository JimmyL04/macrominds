import { Card } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { metricOptions, chartTypeOptions } from "@/app/services/api";
import { BarChart3, LineChart, AreaChart, Info } from "lucide-react";

interface ChartControlsProps {
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
  timePeriod: string;
  onTimePeriodChange: (period: string) => void;
  chartType: string;
  onChartTypeChange: (type: string) => void;
  availableYears: number[];
  selectedYears: number[];
  onYearsChange: (years: number[]) => void;
  forecastMonths: number;
  onForecastMonthsChange: (months: number) => void;
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

export function ChartControls({
  selectedMetrics,
  onMetricsChange,
  timePeriod,
  onTimePeriodChange,
  chartType,
  onChartTypeChange,
  availableYears,
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
    { value: 24, label: "2 Years"   },
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
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              Select Metrics
              <InfoTooltip text="Pick which indicators to show on the chart. All three can be on at once." />
            </h3>
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

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              Time Period
              <InfoTooltip text="Sets how often data points appear. Monthly = every month, Quarterly = every 3 months. Also changes how forecast points are spaced." />
            </h3>
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

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
              Select Years
              <InfoTooltip text="Limit the chart to specific years. Useful for comparing a particular stretch of time." />
            </h3>
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

        <div className="border-t border-gray-100 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900 shrink-0 flex items-center">
              Forecast Horizon
              <InfoTooltip text="How far into the future the forecast lines extend past today." />
            </h3>
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
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ${
              forecastMonths === 24 ? "max-h-16 opacity-100 mt-2" : "max-h-0 opacity-0"
            }`}
          >
            <p className="text-xs text-gray-400 leading-relaxed">
              ⚠ Accuracy drops off past 12 months. Treat these figures as rough estimates.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
