import React, { memo, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, AlertTriangle, TrendingDown, Target, UserMinus } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChurnData {
  segment: string;
  currentChurn: number;
  predictedChurn: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  customers: number;
  revenue: number;
}

interface CustomerRisk {
  id: string;
  name: string;
  segment: string;
  riskScore: number;
  revenue: number;
  lastActivity: string;
  churnProbability: number;
  timeToChurn: number;
  riskFactors: string[];
}

interface ChurnPredictionProps {
  data?: ChurnData[];
  riskCustomers?: CustomerRisk[];
  isLoading?: boolean;
  className?: string;
  onCustomerAction?: (customerId: string, action: string) => void;
}

const mockData: ChurnData[] = [
  { segment: 'Enterprise', currentChurn: 3.2, predictedChurn: 4.1, riskLevel: 'medium', customers: 145, revenue: 2.8 },
  { segment: 'SMB', currentChurn: 8.7, predictedChurn: 11.2, riskLevel: 'high', customers: 892, revenue: 1.2 },
  { segment: 'Startup', currentChurn: 15.3, predictedChurn: 18.9, riskLevel: 'critical', customers: 1247, revenue: 0.6 },
  { segment: 'Enterprise+', currentChurn: 1.8, predictedChurn: 2.3, riskLevel: 'low', customers: 67, revenue: 4.2 },
];

const mockRiskCustomers: CustomerRisk[] = [
  {
    id: '1',
    name: 'TechCorp Inc.',
    segment: 'Enterprise',
    riskScore: 87,
    revenue: 125000,
    lastActivity: '2024-04-05T10:30:00Z',
    churnProbability: 0.73,
    timeToChurn: 21,
    riskFactors: ['Decreased usage', 'Support tickets', 'Payment delays']
  },
  {
    id: '2',
    name: 'StartupXYZ',
    segment: 'Startup',
    riskScore: 92,
    revenue: 15000,
    lastActivity: '2024-04-01T14:20:00Z',
    churnProbability: 0.85,
    timeToChurn: 14,
    riskFactors: ['No recent activity', 'Failed payments', 'Support complaints']
  },
  {
    id: '3',
    name: 'MidSize Solutions',
    segment: 'SMB',
    riskScore: 78,
    revenue: 45000,
    lastActivity: '2024-04-08T09:15:00Z',
    churnProbability: 0.68,
    timeToChurn: 35,
    riskFactors: ['Usage decline', 'Feature requests ignored']
  },
  {
    id: '4',
    name: 'BigEnterprise Ltd.',
    segment: 'Enterprise+',
    riskScore: 65,
    revenue: 250000,
    lastActivity: '2024-04-09T16:45:00Z',
    churnProbability: 0.55,
    timeToChurn: 42,
    riskFactors: ['Contract renewal pending', 'New competitor evaluation']
  }
];

const ChurnPrediction: React.FC<ChurnPredictionProps> = memo(({
  data = mockData,
  riskCustomers = mockRiskCustomers,
  isLoading = false,
  className = '',
  onCustomerAction
}) => {
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'risk' | 'revenue' | 'timeToChurn'>('risk');
  const [showOnlyHigh, setShowOnlyHigh] = useState(false);

  const metrics = useMemo(() => {
    const totalCustomers = data.reduce((sum, item) => sum + item.customers, 0);
    const weightedCurrentChurn = data.reduce((sum, item) => sum + (item.currentChurn * item.customers), 0) / totalCustomers;
    const weightedPredictedChurn = data.reduce((sum, item) => sum + (item.predictedChurn * item.customers), 0) / totalCustomers;
    const revenueAtRisk = riskCustomers.filter(c => c.churnProbability > 0.7).reduce((sum, c) => sum + c.revenue, 0);
    const highRiskCustomers = riskCustomers.filter(c => c.riskScore >= 80).length;

    return {
      totalCustomers,
      currentChurn: weightedCurrentChurn,
      predictedChurn: weightedPredictedChurn,
      churnIncrease: weightedPredictedChurn - weightedCurrentChurn,
      revenueAtRisk,
      highRiskCustomers
    };
  }, [data, riskCustomers]);

  const filteredRiskCustomers = useMemo(() => {
    let filtered = riskCustomers;

    if (selectedSegment !== 'all') {
      filtered = filtered.filter(customer => customer.segment === selectedSegment);
    }

    if (showOnlyHigh) {
      filtered = filtered.filter(customer => customer.riskScore >= 80);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          return b.riskScore - a.riskScore;
        case 'revenue':
          return b.revenue - a.revenue;
        case 'timeToChurn':
          return a.timeToChurn - b.timeToChurn;
        default:
          return 0;
      }
    });
  }, [riskCustomers, selectedSegment, showOnlyHigh, sortBy]);

  const riskLevelConfig = {
    low: { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
  };

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
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `$${(value / 1000).toFixed(0)}K`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatDays = (value: number) => `${value} days`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Customer Churn Prediction</h3>
          <p className="text-sm text-gray-600">AI-powered retention analysis and risk assessment</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <UserMinus className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
              +{formatPercent(metrics.churnIncrease)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Predicted Churn</p>
          <p className="text-xl font-bold text-red-700">{formatPercent(metrics.predictedChurn)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-100"
        >
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
              High Risk
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">At-Risk Customers</p>
          <p className="text-xl font-bold text-yellow-700">{metrics.highRiskCustomers}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              Revenue
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Revenue at Risk</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(metrics.revenueAtRisk)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-green-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
              Total
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Customer Base</p>
          <p className="text-xl font-bold text-green-700">{metrics.totalCustomers.toLocaleString()}</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn by Segment Chart */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Churn Rate by Segment</h4>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="segment"
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={formatPercent}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatPercent(value), name]}
                  labelStyle={{ color: '#374151' }}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar
                  dataKey="currentChurn"
                  fill="#6B7280"
                  radius={[2, 2, 0, 0]}
                  name="Current Churn"
                />
                <Bar
                  dataKey="predictedChurn"
                  fill="#F59E0B"
                  radius={[2, 2, 0, 0]}
                  name="Predicted Churn"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Segment Risk Levels */}
          <div className="space-y-2">
            {data.map((segment, index) => {
              const riskStyle = riskLevelConfig[segment.riskLevel];
              return (
                <motion.div
                  key={segment.segment}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={`p-3 rounded-lg border ${riskStyle.bg} ${riskStyle.border}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">{segment.segment}</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${riskStyle.color} ${riskStyle.bg}`}>
                        {segment.riskLevel.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{segment.customers} customers</p>
                      <p className="text-xs text-gray-600">{formatCurrency(segment.revenue * 1000)} revenue</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* High-Risk Customers List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">High-Risk Customers</h4>
            <div className="flex items-center space-x-2">
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Segments</option>
                {data.map(item => (
                  <option key={item.segment} value={item.segment}>{item.segment}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="risk">Sort by Risk</option>
                <option value="revenue">Sort by Revenue</option>
                <option value="timeToChurn">Sort by Time to Churn</option>
              </select>
            </div>
          </div>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showOnlyHigh}
              onChange={(e) => setShowOnlyHigh(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-600">Show only high risk (80%+)</span>
          </label>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredRiskCustomers.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{customer.name}</span>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                        {customer.segment}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      <span>Risk: {customer.riskScore}%</span>
                      <span>Revenue: {formatCurrency(customer.revenue)}</span>
                      <span>Churn in: {formatDays(customer.timeToChurn)}</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                    customer.riskScore >= 90 ? 'bg-red-100 text-red-700' :
                    customer.riskScore >= 80 ? 'bg-orange-100 text-orange-700' :
                    customer.riskScore >= 70 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {(customer.churnProbability * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex flex-wrap gap-1">
                    {customer.riskFactors.map((factor, factorIndex) => (
                      <span
                        key={factorIndex}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full"
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Last activity: {new Date(customer.lastActivity).toLocaleDateString()}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onCustomerAction?.(customer.id, 'contact')}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      Contact
                    </button>
                    <button
                      onClick={() => onCustomerAction?.(customer.id, 'offer')}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                    >
                      Special Offer
                    </button>
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
            <span>Model: Random Forest + Neural Network</span>
            <span>•</span>
            <span>Accuracy: 89.3%</span>
            <span>•</span>
            <span>Updated: Daily</span>
          </div>
          <span>Next model retrain: {new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
        </div>
      </div>
    </motion.div>
  );
});

ChurnPrediction.displayName = 'ChurnPrediction';

export default ChurnPrediction;