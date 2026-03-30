import { Card } from "@/app/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  trend: "up" | "down" | "stable";
  invertColors?: boolean; // For metrics where "up" is bad (like unemployment)
}

export function MetricCard({ title, value, change, trend, invertColors = false }: MetricCardProps) {
  const isPositive = invertColors ? trend === "down" : trend === "up";
  const isNegative = invertColors ? trend === "up" : trend === "down";
  
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="size-4" />;
    if (trend === "down") return <TrendingDown className="size-4" />;
    return <Minus className="size-4" />;
  };

  const getTrendColor = () => {
    if (isPositive) return "text-green-600";
    if (isNegative) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <Card className="p-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-semibold">{value}</p>
          <div className={`flex items-center gap-1 ${getTrendColor()}`}>
            {getTrendIcon()}
            <span className="text-sm font-medium">
              {change > 0 ? "+" : ""}{change}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
