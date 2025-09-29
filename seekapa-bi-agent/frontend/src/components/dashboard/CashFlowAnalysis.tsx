import React, { memo, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, ArrowUpCircle, DollarSign, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

interface CashFlowData {
  month: string;
  operatingCF: number;
  investingCF: number;
  financingCF: number;
  netCF: number;
  freeCF: number;
  cashBalance: number;
}

interface CashFlowAnalysisProps {
  data?: CashFlowData[];
  isLoading?: boolean;
  className?: string;
}

const mockData: CashFlowData[] = [
  { month: 'Jan', operatingCF: 8.2, investingCF: -2.1, financingCF: -1.8, netCF: 4.3, freeCF: 6.1, cashBalance: 45.2 },
  { month: 'Feb', operatingCF: 9.1, investingCF: -1.8, financingCF: -2.2, netCF: 5.1, freeCF: 7.3, cashBalance: 50.3 },
  { month: 'Mar', operatingCF: 10.5, investingCF: -3.2, financingCF: -1.5, netCF: 5.8, freeCF: 7.3, cashBalance: 56.1 },
  { month: 'Apr', operatingCF: 8.9, investingCF: -2.5, financingCF: -2.8, netCF: 3.6, freeCF: 6.4, cashBalance: 59.7 },
  { month: 'May', operatingCF: 11.2, investingCF: -1.9, financingCF: -2.1, netCF: 7.2, freeCF: 9.3, cashBalance: 66.9 },
  { month: 'Jun', operatingCF: 12.1, investingCF: -2.8, financingCF: -1.9, netCF: 7.4, freeCF: 9.3, cashBalance: 74.3 },
];

const CashFlowAnalysis: React.FC<CashFlowAnalysisProps> = memo(({
  data = mockData,
  isLoading = false,
  className = ''
}) => {
  const metrics = useMemo(() => {
    if (!data.length) return {
      operatingCFGrowth: 0,
      freeCFMargin: 0,
      cashBurnRate: 0,
      daysOfCash: 0,
      currentCashBalance: 0,
      totalOperatingCF: 0
    };

    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    const monthlyRevenue = 58.2; // Assuming latest revenue from RevenueGrowth

    const operatingCFGrowth = previous ? ((latest.operatingCF - previous.operatingCF) / Math.abs(previous.operatingCF)) * 100 : 0;
    const freeCFMargin = (latest.freeCF / monthlyRevenue) * 100;
    const cashBurnRate = data.slice(-3).reduce((sum, item) => sum + Math.abs(item.netCF), 0) / 3;
    const daysOfCash = latest.cashBalance / (cashBurnRate / 30);
    const totalOperatingCF = data.reduce((sum, item) => sum + item.operatingCF, 0);

    return {
      operatingCFGrowth,
      freeCFMargin,
      cashBurnRate,
      daysOfCash,
      currentCashBalance: latest.cashBalance,
      totalOperatingCF
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
  const formatDays = (value: number) => `${Math.round(value)} days`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Cash Flow Analysis</h3>
          <p className="text-sm text-gray-600">Operating, investing, and financing activities</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-full">
          <DollarSign className="w-6 h-6 text-amber-600" />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <ArrowUpCircle className="w-5 h-5 text-green-600" />
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              metrics.operatingCFGrowth >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {formatPercentChange(metrics.operatingCFGrowth)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Operating CF</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(data[data.length - 1]?.operatingCF || 0)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              Margin
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Free CF Margin</p>
          <p className="text-xl font-bold text-blue-700">{formatPercent(metrics.freeCFMargin)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700">
              Runway
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Days of Cash</p>
          <p className="text-xl font-bold text-purple-700">{formatDays(metrics.daysOfCash)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100"
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              Balance
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Cash Balance</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(metrics.currentCashBalance)}</p>
        </motion.div>
      </div>

      {/* Chart Section */}
      <div className="space-y-6">
        {/* Cash Flow Waterfall */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly Cash Flow Breakdown</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />

                <Bar
                  dataKey="operatingCF"
                  fill="#10B981"
                  radius={[2, 2, 0, 0]}
                  name="Operating CF"
                />
                <Bar
                  dataKey="investingCF"
                  fill="#EF4444"
                  radius={[2, 2, 0, 0]}
                  name="Investing CF"
                />
                <Bar
                  dataKey="financingCF"
                  fill="#F59E0B"
                  radius={[2, 2, 0, 0]}
                  name="Financing CF"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cash Balance Trend */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Cash Balance & Free Cash Flow Trend</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCashBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFreeCF" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
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
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
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
                  dataKey="cashBalance"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fill="url(#colorCashBalance)"
                  name="Cash Balance"
                />
                <Area
                  type="monotone"
                  dataKey="freeCF"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#colorFreeCF)"
                  name="Free Cash Flow"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cash Flow Summary */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Operating Efficiency</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>6M Total Operating CF:</span>
                <span className="font-medium text-green-600">{formatCurrency(metrics.totalOperatingCF)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Avg Monthly Growth:</span>
                <span className="font-medium">{formatPercentChange(metrics.operatingCFGrowth / 6)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Capital Allocation</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Cash Burn Rate:</span>
                <span className="font-medium">{formatCurrency(metrics.cashBurnRate)}/month</span>
              </div>
              <div className="flex items-center justify-between">
                <span>FCF Conversion:</span>
                <span className="font-medium text-blue-600">{formatPercent(metrics.freeCFMargin)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Liquidity Status</h4>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span>Operating</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span>Investing</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                <span>Financing</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Last updated: {new Date().toLocaleString()} | Cash runway based on current burn rate
        </div>
      </div>
    </motion.div>
  );
});

CashFlowAnalysis.displayName = 'CashFlowAnalysis';

export default CashFlowAnalysis;