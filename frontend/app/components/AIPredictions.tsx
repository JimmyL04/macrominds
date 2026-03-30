import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { type ForecastPoint } from "@/app/services/api";

interface AIPredictionsProps {
  loading: boolean;
  unempCurrent: number | null;
  unempPredicted: number | null;
  inflationCurrent: number | null;
  inflationPredicted: number | null;
  forecastData: ForecastPoint[];
}

interface PredictionRow {
  metric: string;
  currentValue: number | null;
  predictedValue: number | null;
  /** For unemployment/inflation, a decrease is "good" */
  invertColors: boolean;
}

export function AIPredictions({
  loading,
  unempCurrent,
  unempPredicted,
  inflationCurrent,
  inflationPredicted,
  forecastData,
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

  // Horizon table: indices 2 / 5 / 11 → 3mo / 6mo / 12mo
  const horizons = [
    { label: "3 months",  index: 2  },
    { label: "6 months",  index: 5  },
    { label: "12 months", index: 11 },
  ];

  const hasHorizonData = forecastData.length > 0;

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
          {[1, 2].map((i) => (
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
                      <th className="text-center px-3 py-2 font-semibold text-gray-700">
                        Inflation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {horizons.map(({ label, index }) => {
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
                          <td className="px-3 py-2 text-center font-semibold text-amber-600">
                            {point ? `${point.predicted_inflation.toFixed(2)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Model:</span> XGBoost with autoregressive
          features trained on FRED data. Predictions reflect the next-month nowcast
          based on the most recent economic indicators.
        </p>
      </div>
    </Card>
  );
}
