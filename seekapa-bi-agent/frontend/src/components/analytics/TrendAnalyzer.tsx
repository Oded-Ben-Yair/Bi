import React, { memo, useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, Activity, Filter, ArrowUp, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface TrendData {
  period: string;
  current: number;
  previous: number;
  yoy: number;
  qoq?: number;
  mom?: number;
  category: string;
}

interface TrendMetrics {
  metric: string;
  current: number;
  previous: number;
  yoyChange: number;
  qoqChange: number;
  momChange: number;
  trend: 'up' | 'down' | 'stable';
  significance: 'high' | 'medium' | 'low';
}

interface TrendAnalyzerProps {
  data?: TrendData[];
  metrics?: TrendMetrics[];
  isLoading?: boolean;
  className?: string;
  timeframe?: 'monthly' | 'quarterly' | 'yearly';
  onTimeframeChange?: (timeframe: 'monthly' | 'quarterly' | 'yearly') => void;
}

const mockData: TrendData[] = [
  { period: 'Q1 2023', current: 42.1, previous: 38.5, yoy: 9.4, category: 'Revenue' },
  { period: 'Q2 2023', current: 48.7, previous: 44.2, yoy: 10.2, category: 'Revenue' },
  { period: 'Q3 2023', current: 52.1, previous: 46.8, yoy: 11.3, category: 'Revenue' },
  { period: 'Q4 2023', current: 49.3, previous: 45.1, yoy: 9.3, category: 'Revenue' },
  { period: 'Q1 2024', current: 55.8, previous: 42.1, yoy: 32.5, qoq: 13.2, category: 'Revenue' },
  { period: 'Q2 2024', current: 58.2, previous: 48.7, yoy: 19.5, qoq: 4.3, category: 'Revenue' },
];

const mockMetrics: TrendMetrics[] = [
  { metric: 'Revenue', current: 58.2, previous: 48.7, yoyChange: 19.5, qoqChange: 4.3, momChange: 2.1, trend: 'up', significance: 'high' },
  { metric: 'Customer Acquisition', current: 1247, previous: 892, yoyChange: 39.8, qoqChange: 15.2, momChange: 8.7, trend: 'up', significance: 'high' },
  { metric: 'ARPU', current: 125, previous: 118, yoyChange: 5.9, qoqChange: 2.3, momChange: 1.8, trend: 'up', significance: 'medium' },
  { metric: 'Churn Rate', current: 5.2, previous: 6.8, yoyChange: -23.5, qoqChange: -8.1, momChange: -2.3, trend: 'down', significance: 'high' },
  { metric: 'Operating Margin', current: 24.2, previous: 22.1, yoyChange: 9.5, qoqChange: 3.2, momChange: 1.5, trend: 'up', significance: 'medium' },
  { metric: 'Customer Satisfaction', current: 4.6, previous: 4.3, yoyChange: 7.0, qoqChange: 2.1, momChange: 0.8, trend: 'up', significance: 'low' },
];

const TrendAnalyzer: React.FC<TrendAnalyzerProps> = memo(({
  data = mockData,
  metrics = mockMetrics,
  isLoading = false,
  className = '',
  timeframe = 'quarterly',
  onTimeframeChange
}) => {
  const [selectedMetric, setSelectedMetric] = useState<string>('all');
  const [comparisonType, setComparisonType] = useState<'yoy' | 'qoq' | 'mom'>('yoy');
  const [showTrendLines, setShowTrendLines] = useState(true);

  const trendSummary = useMemo(() => {
    const positiveMetrics = metrics.filter(m =>
      (m.metric !== 'Churn Rate' && m.yoyChange > 0) || (m.metric === 'Churn Rate' && m.yoyChange < 0)
    ).length;

    const negativeMetrics = metrics.filter(m =>
      (m.metric !== 'Churn Rate' && m.yoyChange < 0) || (m.metric === 'Churn Rate' && m.yoyChange > 0)
    ).length;

    const avgYoyGrowth = metrics
      .filter(m => m.metric !== 'Churn Rate')
      .reduce((sum, m) => sum + m.yoyChange, 0) / metrics.filter(m => m.metric !== 'Churn Rate').length;

    const strongTrends = metrics.filter(m => m.significance === 'high').length;

    return { positiveMetrics, negativeMetrics, avgYoyGrowth, strongTrends };
  }, [metrics]);

  const chartData = useMemo(() => {
    if (selectedMetric === 'all') return data;
    return data.filter(d => d.category === selectedMetric);
  }, [data, selectedMetric]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const formatValue = (value: number, metric: string) => {
    if (metric === 'Revenue') return `$${value.toFixed(1)}M`;
    if (metric === 'Customer Acquisition') return value.toString();
    if (metric === 'ARPU') return `$${value}`;
    if (metric === 'Churn Rate') return `${value.toFixed(1)}%`;
    if (metric === 'Operating Margin') return `${value.toFixed(1)}%`;
    if (metric === 'Customer Satisfaction') return `${value.toFixed(1)}/5`;
    return value.toString();
  };

  const getComparisonValue = (metric: TrendMetrics) => {
    switch (comparisonType) {
      case 'yoy': return metric.yoyChange;
      case 'qoq': return metric.qoqChange;
      case 'mom': return metric.momChange;
      default: return metric.yoyChange;
    }
  };

  const getTrendColor = (metric: TrendMetrics) => {
    const value = getComparisonValue(metric);
    const isGoodTrend = metric.metric === 'Churn Rate' ? value < 0 : value > 0;

    if (isGoodTrend) {
      return metric.significance === 'high' ? 'text-green-700 bg-green-50 border-green-200' :
             metric.significance === 'medium' ? 'text-green-600 bg-green-50 border-green-200' :
             'text-green-500 bg-green-50 border-green-200';
    } else {
      return metric.significance === 'high' ? 'text-red-700 bg-red-50 border-red-200' :
             metric.significance === 'medium' ? 'text-red-600 bg-red-50 border-red-200' :
             'text-red-500 bg-red-50 border-red-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Trend Analysis</h3>
          <p className="text-sm text-gray-600">Year-over-year and quarter-over-quarter comparisons</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <BarChart3 className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex space-x-2">
            {(['monthly', 'quarterly', 'yearly'] as const).map((period) => (
              <button
                key={period}
                onClick={() => onTimeframeChange?.(period)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  timeframe === period
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <ArrowUp className="w-5 h-5 text-green-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
              Positive
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Improving Metrics</p>
          <p className="text-2xl font-bold text-green-700">{trendSummary.positiveMetrics}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100"
        >
          <div className="flex items-center justify-between mb-2">
            <ArrowDown className="w-5 h-5 text-red-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
              Negative
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Declining Metrics</p>
          <p className="text-2xl font-bold text-red-700">{trendSummary.negativeMetrics}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              YoY Avg
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Growth Rate</p>
          <p className="text-xl font-bold text-blue-700">{formatPercent(trendSummary.avgYoyGrowth)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              Strong
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Significant Trends</p>
          <p className="text-2xl font-bold text-amber-700">{trendSummary.strongTrends}</p>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Metrics</option>
              <option value="Revenue">Revenue</option>
              <option value="Customers">Customers</option>
              <option value="Operations">Operations</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Compare:</span>
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="yoy">Year over Year</option>
              <option value="qoq">Quarter over Quarter</option>
              <option value="mom">Month over Month</option>
            </select>
          </div>
        </div>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showTrendLines}
            onChange={(e) => setShowTrendLines(e.target.checked)}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          <span className="text-sm text-gray-600">Show trend lines</span>
        </label>
      </div>

      {/* Trend Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="previousGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6B7280" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#6B7280" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="period"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${value}M`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [`$${value.toFixed(1)}M`, name]}
              labelStyle={{ color: '#374151' }}
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            />

            <Area
              type="monotone"
              dataKey="current"
              stroke="#F59E0B"
              strokeWidth={3}
              fill="url(#currentGradient)"
              name="Current Period"
            />
            <Area
              type="monotone"
              dataKey="previous"
              stroke="#6B7280"
              strokeWidth={2}
              fill="url(#previousGradient)"
              name="Previous Period"
            />

            {showTrendLines && (
              <Line
                type="monotone"
                dataKey="yoy"
                stroke="#10B981"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                yAxisId="right"
                name="YoY Growth %"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics Comparison Table */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700">Detailed Trend Analysis</h4>

        <div className="overflow-x-auto">
          <div className="grid gap-2">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.metric}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`p-4 rounded-lg border ${getTrendColor(metric)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-semibold">{metric.metric}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        metric.significance === 'high' ? 'bg-red-100 text-red-700' :
                        metric.significance === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {metric.significance.toUpperCase()}
                      </span>
                      {metric.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : metric.trend === 'down' ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : (
                        <Activity className="w-4 h-4 text-gray-600" />
                      )}
                    </div>

                    <div className="flex items-center space-x-6 mt-2 text-sm">
                      <div>
                        <span className="text-gray-600">Current: </span>
                        <span className="font-medium">{formatValue(metric.current, metric.metric)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Previous: </span>
                        <span className="font-medium">{formatValue(metric.previous, metric.metric)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-sm">
                    <div className="text-center">
                      <p className="text-gray-600">YoY</p>
                      <p className="font-semibold">{formatPercent(metric.yoyChange)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">QoQ</p>
                      <p className="font-semibold">{formatPercent(metric.qoqChange)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-600">MoM</p>
                      <p className="font-semibold">{formatPercent(metric.momChange)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
              <span>Current Period</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span>Previous Period</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Growth Trend</span>
            </div>
          </div>
          <span>Data updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
});

TrendAnalyzer.displayName = 'TrendAnalyzer';

export default TrendAnalyzer;