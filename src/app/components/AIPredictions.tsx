import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface Prediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  timeframe: string;
  confidence: number;
}

const mockPredictions: Prediction[] = [
  {
    metric: "Unemployment Rate",
    currentValue: 3.7,
    predictedValue: 3.5,
    timeframe: "6 months",
    confidence: 87,
  },
  {
    metric: "Inflation Rate",
    currentValue: 3.2,
    predictedValue: 2.8,
    timeframe: "6 months",
    confidence: 82,
  },
  {
    metric: "Poverty Rate",
    currentValue: 11.5,
    predictedValue: 11.2,
    timeframe: "6 months",
    confidence: 79,
  },
  {
    metric: "GDP Growth",
    currentValue: 2.8,
    predictedValue: 3.1,
    timeframe: "6 months",
    confidence: 85,
  },
];

export function AIPredictions() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Predictions</h3>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            Beta
          </Badge>
        </div>
        <Button variant="outline" size="sm" disabled>
          <span className="text-sm">Connect AI Model</span>
        </Button>
      </div>

      <div className="space-y-4">
        {mockPredictions.map((prediction) => {
          const change = prediction.predictedValue - prediction.currentValue;
          const percentChange = ((change / prediction.currentValue) * 100).toFixed(1);
          const isPositive = change < 0; // For economic metrics, decrease is often positive

          return (
            <div
              key={prediction.metric}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900">{prediction.metric}</p>
                  <Badge variant="outline" className="text-xs">
                    {prediction.timeframe}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Current: <span className="font-semibold">{prediction.currentValue}%</span>
                  {" → "}
                  Predicted: <span className="font-semibold">{prediction.predictedValue}%</span>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`flex items-center gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                    {isPositive ? (
                      <TrendingDown className="size-4" />
                    ) : (
                      <TrendingUp className="size-4" />
                    )}
                    <span className="font-semibold text-sm">
                      {change > 0 ? "+" : ""}{percentChange}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {prediction.confidence}% confidence
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Note:</span> These are mock predictions for demonstration purposes. 
          Connect your AI model to see real predictions based on your data.
        </p>
      </div>
    </Card>
  );
}
