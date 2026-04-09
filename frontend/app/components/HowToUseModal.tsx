import { useEffect } from "react";
import { X } from "lucide-react";

interface HowToUseModalProps {
  onClose: () => void;
}

const sections = [
  {
    title: "Key Indicators",
    body: "The three cards at the top show the latest values for Unemployment Rate, Inflation Rate, and GDP Growth. The colored percentage next to each shows the change from the prior period. Green means the number moved in a good direction; red means it moved in a bad one.",
  },
  {
    title: "Refresh Data",
    body: "Click 'Refresh Data' to fetch the latest figures from FRED and BLS. All charts, predictions, and indicators update automatically.",
  },
  {
    title: "Select Metrics",
    body: "Check or uncheck which indicators appear on the chart. Each works independently.",
  },
  {
    title: "Chart Type",
    body: "Choose between Line, Bar, and Area views.",
  },
  {
    title: "Time Period",
    body: "Sets how frequently data points appear on the chart. Monthly = every month, Quarterly = every 3 months. This also changes how forecast points are spaced.",
  },
  {
    title: "Select Years",
    body: "Limit the chart to specific years of historical data. Good for comparing a particular stretch of time.",
  },
  {
    title: "Forecast Horizon",
    body: "Sets how far out the forecast lines extend past today. The 'Now' line marks where real data ends and predictions begin. The shaded bands show the confidence interval, which widens the further out you go.",
  },
  {
    title: "Show AI Predictions",
    body: "Turns the model's forecast lines on or off. Dashed lines cover both historical data (as a backtest) and future dates.",
  },
  {
    title: "Date Lookup",
    body: "Enter a month and year (e.g. 'Jun 2026') to see the economic figures for that date. Historical dates pull from real data; future dates use model estimates. A blue marker appears on the chart to mark the point.",
  },
  {
    title: "Forecast Horizon Table",
    body: "Predicted unemployment and inflation at 3, 6, 12, and 24 months out from today.",
  },
];

export function HowToUseModal({ onClose }: HowToUseModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">How to Use the Dashboard</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-5">
          <div className="space-y-0">
            {sections.map((section, i) => (
              <div key={section.title}>
                <div className="py-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {section.body}
                  </p>
                </div>
                {i < sections.length - 1 && (
                  <div className="border-t border-gray-100" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
