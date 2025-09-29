import React, { memo, useMemo } from 'react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { TrendingUp, Percent, Calculator, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface ProfitabilityData {
  month: string;
  revenue: number;
  ebitda: number;
  netMargin: number;
  grossMargin: number;
  operatingMargin: number;
}

interface ProfitabilityKPIProps {
  data?: ProfitabilityData[];
  isLoading?: boolean;
  className?: string;
}

const mockData: ProfitabilityData[] = [
  { month: 'Jan', revenue: 45.2, ebitda: 12.4, netMargin: 18.5, grossMargin: 42.1, operatingMargin: 24.2 },
  { month: 'Feb', revenue: 48.7, ebitda: 14.2, netMargin: 19.8, grossMargin: 43.5, operatingMargin: 25.8 },
  { month: 'Mar', revenue: 52.1, ebitda: 16.1, netMargin: 21.2, grossMargin: 44.8, operatingMargin: 27.1 },
  { month: 'Apr', revenue: 49.3, ebitda: 14.8, netMargin: 20.1, grossMargin: 43.9, operatingMargin: 26.2 },
  { month: 'May', revenue: 55.8, ebitda: 17.8, netMargin: 22.4, grossMargin: 46.2, operatingMargin: 28.9 },
  { month: 'Jun', revenue: 58.2, ebitda: 19.2, netMargin: 23.1, grossMargin: 47.1, operatingMargin: 29.8 },
];

const ProfitabilityKPI: React.FC<ProfitabilityKPIProps> = memo(({
  data = mockData,
  isLoading = false,
  className = ''
}) => {
  const metrics = useMemo(() => {
    if (!data.length) return {
      ebitdaGrowth: 0,
      marginTrend: 0,
      currentEbitda: 0,
      currentNetMargin: 0,
      avgGrossMargin: 0,
      avgOperatingMargin: 0
    };

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];

    const ebitdaGrowth = previous ? ((latest.ebitda - previous.ebitda) / previous.ebitda) * 100 : 0;
    const marginTrend = previous ? ((latest.netMargin - previous.netMargin) / previous.netMargin) * 100 : 0;
    const avgGrossMargin = data.reduce((sum, item) => sum + item.grossMargin, 0) / data.length;
    const avgOperatingMargin = data.reduce((sum, item) => sum + item.operatingMargin, 0) / data.length;

    return {
      ebitdaGrowth,
      marginTrend,
      currentEbitda: latest.ebitda,
      currentNetMargin: latest.netMargin,
      avgGrossMargin,
      avgOperatingMargin
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `$${value.toFixed(1)}M`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatPercentChange = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Profitability Analysis</h3>
          <p className="text-sm text-gray-600">EBITDA, margins, and operational efficiency</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-full">
          <Calculator className="w-6 h-6 text-amber-600" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <PieChartIcon className="w-5 h-5 text-blue-600" />
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              metrics.ebitdaGrowth >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {formatPercentChange(metrics.ebitdaGrowth)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">EBITDA</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(metrics.currentEbitda)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Percent className="w-5 h-5 text-green-600" />
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              metrics.marginTrend >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {formatPercentChange(metrics.marginTrend)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Net Margin</p>
          <p className="text-xl font-bold text-green-700">{formatPercent(metrics.currentNetMargin)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              6M Avg
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Gross Margin</p>
          <p className="text-xl font-bold text-purple-700">{formatPercent(metrics.avgGrossMargin)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
              6M Avg
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Operating Margin</p>
          <p className="text-xl font-bold text-amber-700">{formatPercent(metrics.avgOperatingMargin)}</p>
        </motion.div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="month"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatCurrency}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatPercent}
            />
            <Tooltip
              formatter={(value: number, name: string, props: any) => {
                const formatter = props.payload.dataKey.includes('Margin') ? formatPercent : formatCurrency;
                return [formatter(value), name];
              }}
              labelStyle={{ color: '#374151' }}
              contentStyle={{
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
            />

            {/* Revenue and EBITDA Bars */}
            <Bar
              yAxisId="left"
              dataKey="revenue"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name="Revenue"
              opacity={0.8}
            />
            <Bar
              yAxisId="left"
              dataKey="ebitda"
              fill="#F59E0B"
              radius={[4, 4, 0, 0]}
              name="EBITDA"
              opacity={0.9}
            />

            {/* Margin Lines */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="netMargin"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              name="Net Margin"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="operatingMargin"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 3 }}
              name="Operating Margin"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Profitability Insights */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Key Insights</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>EBITDA Margin:</span>
                <span className="font-medium">{formatPercent((metrics.currentEbitda / data[data.length - 1]?.revenue || 0) * 100)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Margin Expansion:</span>
                <span className={`font-medium ${metrics.marginTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentChange(metrics.marginTrend)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Performance Indicators</h4>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span>Revenue</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                <span>EBITDA</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span>Net Margin</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Last updated: {new Date().toLocaleString()} | Data refreshes every 15 minutes
        </div>
      </div>
    </motion.div>
  );
});

ProfitabilityKPI.displayName = 'ProfitabilityKPI';

export default ProfitabilityKPI;