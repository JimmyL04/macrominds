import { MetricCard } from "@/app/components/MetricCard";
import { EconomicChart } from "@/app/components/EconomicChart";
import { ChartControls } from "@/app/components/ChartControls";
import { AIPredictions } from "@/app/components/AIPredictions";
import { currentMetrics } from "@/app/data/economicData";
import { BarChart3 } from "lucide-react";
import { useState } from "react";

export default function App() {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    "unemployment",
    "inflation",
    "gdpGrowth",
  ]);
  const [timePeriod, setTimePeriod] = useState<string>("monthly");
  const [chartType, setChartType] = useState<string>("line");
  const [selectedYears, setSelectedYears] = useState<number[]>([2022, 2023, 2024, 2025]);

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
                Real-time economic indicators and future projections
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Metrics */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Indicators</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          />
          <EconomicChart
            selectedMetrics={selectedMetrics}
            timePeriod={timePeriod}
            chartType={chartType}
            selectedYears={selectedYears}
          />
        </section>

        {/* AI Predictions Section */}
        <section className="mt-8">
          <AIPredictions />
        </section>
      </main>
    </div>
  );
}