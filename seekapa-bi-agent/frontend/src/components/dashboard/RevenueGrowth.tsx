import React, { memo, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface RevenueData {
  month: string;
  current: number;
  previous: number;
  target: number;
  forecast: number;
}

interface RevenueGrowthProps {
  data?: RevenueData[];
  isLoading?: boolean;
  className?: string;
}

const mockData: RevenueData[] = [
  { month: 'Jan', current: 45.2, previous: 42.1, target: 46.0, forecast: 45.8 },
  { month: 'Feb', current: 48.7, previous: 44.3, target: 47.5, forecast: 49.2 },
  { month: 'Mar', current: 52.1, previous: 46.8, target: 49.0, forecast: 52.5 },
  { month: 'Apr', current: 49.3, previous: 48.2, target: 50.5, forecast: 51.8 },
  { month: 'May', current: 55.8, previous: 51.6, target: 52.0, forecast: 56.2 },
  { month: 'Jun', current: 58.2, previous: 53.9, target: 54.0, forecast: 59.1 },
];

const RevenueGrowth: React.FC<RevenueGrowthProps> = memo(({
  data = mockData,
  isLoading = false,
  className = ''
}) => {
  const metrics = useMemo(() => {
    if (!data.length) return { growth: 0, vs_target: 0, vs_previous: 0 };

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    const growth = previous ? ((latest.current - previous.current) / previous.current) * 100 : 0;
    const vs_target = ((latest.current - latest.target) / latest.target) * 100;
    const vs_previous = ((latest.current - latest.previous) / latest.previous) * 100;

    return { growth, vs_target, vs_previous };
  }, [data]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatValue = (value: number) => `$${value.toFixed(1)}M`;
  const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Revenue Growth</h3>
          <p className="text-sm text-gray-600">Monthly performance vs targets</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-full">
          <DollarSign className="w-6 h-6 text-amber-600" />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Month Growth</p>
              <p className="text-2xl font-bold text-green-700">{formatPercent(metrics.growth)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`p-4 rounded-lg border ${
            metrics.vs_target >= 0
              ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-100'
              : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">vs Target</p>
              <p className={`text-2xl font-bold ${
                metrics.vs_target >= 0 ? 'text-blue-700' : 'text-red-700'
              }`}>
                {formatPercent(metrics.vs_target)}
              </p>
            </div>
            <Target className={`w-8 h-8 ${
              metrics.vs_target >= 0 ? 'text-blue-600' : 'text-red-600'
            }`} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">vs Last Year</p>
              <p className="text-2xl font-bold text-amber-700">{formatPercent(metrics.vs_previous)}</p>
            </div>
            {metrics.vs_previous >= 0 ? (
              <TrendingUp className="w-8 h-8 text-amber-600" />
            ) : (
              <TrendingDown className="w-8 h-8 text-amber-600" />
            )}
          </div>
        </motion.div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="month"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatValue}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatValue(value), name]}
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
              fill="url(#colorCurrent)"
              name="Current Revenue"
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#10B981"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#colorForecast)"
              name="Forecast"
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              name="Target"
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke="#6B7280"
              strokeWidth={1}
              dot={false}
              name="Previous Year"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Last updated: {new Date().toLocaleString()}</span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span>Forecast</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
              <span>Target</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

RevenueGrowth.displayName = 'RevenueGrowth';

export default RevenueGrowth;