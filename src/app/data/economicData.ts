// Mock economic data for the dashboard

export interface EconomicMetric {
  title: string;
  value: string;
  change: number;
  trend: "up" | "down" | "stable";
  invertColors?: boolean;
}

export interface TimeSeriesDataPoint {
  date: string;
  unemployment: number;
  inflation: number;
  povertyRate: number;
  gdpGrowth: number;
  isPrediction?: boolean;
  year?: number;
  month?: string;
}

// Current metrics overview
export const currentMetrics: EconomicMetric[] = [
  {
    title: "Unemployment Rate",
    value: "3.7%",
    change: -0.2,
    trend: "down",
    invertColors: true, // Down is good for unemployment
  },
  {
    title: "Inflation Rate",
    value: "3.2%",
    change: -0.5,
    trend: "down",
    invertColors: true, // Down is good for inflation
  },
  {
    title: "Poverty Rate",
    value: "11.5%",
    change: -0.3,
    trend: "down",
    invertColors: true, // Down is good for poverty
  },
  {
    title: "GDP Growth",
    value: "2.8%",
    change: 0.4,
    trend: "up",
    invertColors: false, // Up is good for GDP
  },
];

// Historical data for charts (last 24 months)
export const historicalData: TimeSeriesDataPoint[] = [
  // 2022 data
  { date: "Jan 2022", unemployment: 5.2, inflation: 7.5, povertyRate: 13.8, gdpGrowth: 1.2, year: 2022, month: "Jan" },
  { date: "Feb 2022", unemployment: 5.1, inflation: 7.4, povertyRate: 13.7, gdpGrowth: 1.3, year: 2022, month: "Feb" },
  { date: "Mar 2022", unemployment: 5.0, inflation: 7.3, povertyRate: 13.6, gdpGrowth: 1.3, year: 2022, month: "Mar" },
  { date: "Apr 2022", unemployment: 4.9, inflation: 7.2, povertyRate: 13.5, gdpGrowth: 1.4, year: 2022, month: "Apr" },
  { date: "May 2022", unemployment: 4.8, inflation: 7.0, povertyRate: 13.4, gdpGrowth: 1.4, year: 2022, month: "May" },
  { date: "Jun 2022", unemployment: 4.7, inflation: 6.8, povertyRate: 13.3, gdpGrowth: 1.5, year: 2022, month: "Jun" },
  { date: "Jul 2022", unemployment: 4.6, inflation: 6.5, povertyRate: 13.2, gdpGrowth: 1.5, year: 2022, month: "Jul" },
  { date: "Aug 2022", unemployment: 4.6, inflation: 6.3, povertyRate: 13.1, gdpGrowth: 1.6, year: 2022, month: "Aug" },
  { date: "Sep 2022", unemployment: 4.5, inflation: 6.2, povertyRate: 13.0, gdpGrowth: 1.6, year: 2022, month: "Sep" },
  { date: "Oct 2022", unemployment: 4.5, inflation: 6.0, povertyRate: 13.0, gdpGrowth: 1.7, year: 2022, month: "Oct" },
  { date: "Nov 2022", unemployment: 4.4, inflation: 5.8, povertyRate: 12.9, gdpGrowth: 1.7, year: 2022, month: "Nov" },
  { date: "Dec 2022", unemployment: 4.4, inflation: 5.6, povertyRate: 12.9, gdpGrowth: 1.8, year: 2022, month: "Dec" },
  
  // 2023 data
  { date: "Jan 2023", unemployment: 4.4, inflation: 5.4, povertyRate: 12.9, gdpGrowth: 1.8, year: 2023, month: "Jan" },
  { date: "Feb 2023", unemployment: 4.3, inflation: 5.3, povertyRate: 12.8, gdpGrowth: 1.8, year: 2023, month: "Feb" },
  { date: "Mar 2023", unemployment: 4.3, inflation: 5.3, povertyRate: 12.8, gdpGrowth: 1.9, year: 2023, month: "Mar" },
  { date: "Apr 2023", unemployment: 4.3, inflation: 5.2, povertyRate: 12.8, gdpGrowth: 1.9, year: 2023, month: "Apr" },
  { date: "May 2023", unemployment: 4.3, inflation: 5.2, povertyRate: 12.8, gdpGrowth: 1.9, year: 2023, month: "May" },
  { date: "Jun 2023", unemployment: 4.3, inflation: 5.2, povertyRate: 12.8, gdpGrowth: 1.8, year: 2023, month: "Jun" },
  { date: "Jul 2023", unemployment: 4.3, inflation: 5.2, povertyRate: 12.8, gdpGrowth: 1.8, year: 2023, month: "Jul" },
  { date: "Aug 2023", unemployment: 4.2, inflation: 5.1, povertyRate: 12.7, gdpGrowth: 1.9, year: 2023, month: "Aug" },
  { date: "Sep 2023", unemployment: 4.2, inflation: 5.0, povertyRate: 12.6, gdpGrowth: 1.9, year: 2023, month: "Sep" },
  { date: "Oct 2023", unemployment: 4.1, inflation: 4.9, povertyRate: 12.5, gdpGrowth: 2.0, year: 2023, month: "Oct" },
  { date: "Nov 2023", unemployment: 4.1, inflation: 4.7, povertyRate: 12.4, gdpGrowth: 2.0, year: 2023, month: "Nov" },
  { date: "Dec 2023", unemployment: 4.0, inflation: 4.5, povertyRate: 12.3, gdpGrowth: 2.1, year: 2023, month: "Dec" },
  
  // 2024 data
  { date: "Jan 2024", unemployment: 3.9, inflation: 4.2, povertyRate: 12.1, gdpGrowth: 2.1, year: 2024, month: "Jan" },
  { date: "Feb 2024", unemployment: 3.8, inflation: 4.1, povertyRate: 12.0, gdpGrowth: 2.2, year: 2024, month: "Feb" },
  { date: "Mar 2024", unemployment: 3.8, inflation: 4.0, povertyRate: 11.9, gdpGrowth: 2.3, year: 2024, month: "Mar" },
  { date: "Apr 2024", unemployment: 3.7, inflation: 3.9, povertyRate: 11.8, gdpGrowth: 2.4, year: 2024, month: "Apr" },
  { date: "May 2024", unemployment: 3.7, inflation: 3.8, povertyRate: 11.8, gdpGrowth: 2.5, year: 2024, month: "May" },
  { date: "Jun 2024", unemployment: 3.6, inflation: 3.7, povertyRate: 11.7, gdpGrowth: 2.6, year: 2024, month: "Jun" },
  { date: "Jul 2024", unemployment: 3.6, inflation: 3.6, povertyRate: 11.7, gdpGrowth: 2.6, year: 2024, month: "Jul" },
  { date: "Aug 2024", unemployment: 3.7, inflation: 3.5, povertyRate: 11.6, gdpGrowth: 2.7, year: 2024, month: "Aug" },
  { date: "Sep 2024", unemployment: 3.7, inflation: 3.4, povertyRate: 11.6, gdpGrowth: 2.7, year: 2024, month: "Sep" },
  { date: "Oct 2024", unemployment: 3.7, inflation: 3.3, povertyRate: 11.5, gdpGrowth: 2.8, year: 2024, month: "Oct" },
  { date: "Nov 2024", unemployment: 3.7, inflation: 3.3, povertyRate: 11.5, gdpGrowth: 2.8, year: 2024, month: "Nov" },
  { date: "Dec 2024", unemployment: 3.7, inflation: 3.2, povertyRate: 11.5, gdpGrowth: 2.8, year: 2024, month: "Dec" },
  
  // 2025 data (current)
  { date: "Jan 2025", unemployment: 3.7, inflation: 3.2, povertyRate: 11.5, gdpGrowth: 2.8, year: 2025, month: "Jan" },
];

// AI-generated predictions (mock data)
export const predictedData: TimeSeriesDataPoint[] = [
  { date: "Feb 2025", unemployment: 3.6, inflation: 3.1, povertyRate: 11.4, gdpGrowth: 2.9, isPrediction: true, year: 2025, month: "Feb" },
  { date: "Mar 2025", unemployment: 3.6, inflation: 3.0, povertyRate: 11.4, gdpGrowth: 2.9, isPrediction: true, year: 2025, month: "Mar" },
  { date: "Apr 2025", unemployment: 3.5, inflation: 2.9, povertyRate: 11.3, gdpGrowth: 3.0, isPrediction: true, year: 2025, month: "Apr" },
  { date: "May 2025", unemployment: 3.5, inflation: 2.9, povertyRate: 11.3, gdpGrowth: 3.0, isPrediction: true, year: 2025, month: "May" },
  { date: "Jun 2025", unemployment: 3.5, inflation: 2.8, povertyRate: 11.2, gdpGrowth: 3.1, isPrediction: true, year: 2025, month: "Jun" },
  { date: "Jul 2025", unemployment: 3.5, inflation: 2.8, povertyRate: 11.2, gdpGrowth: 3.1, isPrediction: true, year: 2025, month: "Jul" },
];

// Chart type options
export const chartTypeOptions = [
  { value: "line", label: "Line Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "area", label: "Area Chart" },
];

// Available years for selection
export const availableYears = [2022, 2023, 2024, 2025];

// Metric options for selection
export const metricOptions = [
  { value: "unemployment", label: "Unemployment Rate", color: "#ef4444" },
  { value: "inflation", label: "Inflation Rate", color: "#f59e0b" },
  { value: "povertyRate", label: "Poverty Rate", color: "#8b5cf6" },
  { value: "gdpGrowth", label: "GDP Growth", color: "#10b981" },
];