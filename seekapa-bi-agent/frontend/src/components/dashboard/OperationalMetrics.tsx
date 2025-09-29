import React, { memo, useMemo } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Users, ShoppingCart, Award, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface OperationalData {
  category: string;
  score: number;
  target: number;
  trend: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  metrics: {
    name: string;
    value: number;
    unit: string;
    change: number;
  }[];
}

interface OperationalMetricsProps {
  data?: OperationalData[];
  isLoading?: boolean;
  className?: string;
}

const mockData: OperationalData[] = [
  {
    category: 'Customer Experience',
    score: 87,
    target: 85,
    trend: 4.2,
    status: 'excellent',
    metrics: [
      { name: 'NPS Score', value: 72, unit: '', change: 5.1 },
      { name: 'CSAT', value: 4.6, unit: '/5', change: 0.3 },
      { name: 'Response Time', value: 2.3, unit: 'min', change: -12.5 },
      { name: 'Resolution Rate', value: 94.2, unit: '%', change: 2.8 }
    ]
  },
  {
    category: 'Operational Efficiency',
    score: 82,
    target: 80,
    trend: 2.8,
    status: 'good',
    metrics: [
      { name: 'Process Automation', value: 78, unit: '%', change: 8.2 },
      { name: 'Error Rate', value: 0.34, unit: '%', change: -15.3 },
      { name: 'Cycle Time', value: 4.2, unit: 'days', change: -8.7 },
      { name: 'Capacity Utilization', value: 89.5, unit: '%', change: 3.1 }
    ]
  },
  {
    category: 'Team Performance',
    score: 75,
    target: 85,
    trend: -1.2,
    status: 'warning',
    metrics: [
      { name: 'Employee Satisfaction', value: 7.8, unit: '/10', change: -0.5 },
      { name: 'Productivity Index', value: 112, unit: '', change: -2.1 },
      { name: 'Turnover Rate', value: 8.2, unit: '%', change: 1.8 },
      { name: 'Training Hours', value: 32, unit: 'hrs', change: 12.5 }
    ]
  },
  {
    category: 'Innovation & Growth',
    score: 68,
    target: 75,
    trend: 6.8,
    status: 'warning',
    metrics: [
      { name: 'R&D Investment', value: 12.5, unit: '%', change: 18.2 },
      { name: 'New Features', value: 23, unit: '', change: 27.8 },
      { name: 'Patent Applications', value: 8, unit: '', change: 60.0 },
      { name: 'Time to Market', value: 6.8, unit: 'months', change: -15.2 }
    ]
  }
];

const OperationalMetrics: React.FC<OperationalMetricsProps> = memo(({
  data = mockData,
  isLoading = false,
  className = ''
}) => {
  const overallScore = useMemo(() => {
    if (!data.length) return 0;
    return Math.round(data.reduce((sum, item) => sum + item.score, 0) / data.length);
  }, [data]);

  const statusConfig = {
    excellent: { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    good: { color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    warning: { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
    critical: { color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
  };

  const categoryIcons = {
    'Customer Experience': Users,
    'Operational Efficiency': ShoppingCart,
    'Team Performance': Award,
    'Innovation & Growth': TrendingUp
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === '%') return `${value.toFixed(1)}${unit}`;
    if (unit === '/5' || unit === '/10') return `${value.toFixed(1)}${unit}`;
    if (unit === 'min' || unit === 'days' || unit === 'months') return `${value.toFixed(1)} ${unit}`;
    if (unit === 'hrs') return `${Math.round(value)} ${unit}`;
    return `${value.toFixed(0)}${unit}`;
  };

  const formatChange = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  // Data for radial chart
  const radialData = data.map(item => ({
    name: item.category,
    score: item.score,
    target: item.target,
    fill: item.score >= item.target ? '#10B981' : item.score >= item.target * 0.9 ? '#F59E0B' : '#EF4444'
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className={`bg-white rounded-xl shadow-lg p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Operational Excellence</h3>
          <p className="text-sm text-gray-600">4-category performance scorecard</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <Award className="w-6 h-6 text-amber-600" />
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{overallScore}</p>
            <p className="text-xs text-gray-500">Overall Score</p>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {data.map((category, index) => {
          const IconComponent = categoryIcons[category.category as keyof typeof categoryIcons] || Award;
          const statusStyle = statusConfig[category.status];

          return (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-lg border ${statusStyle.bgColor} ${statusStyle.borderColor}`}
            >
              <div className="flex items-center justify-between mb-3">
                <IconComponent className={`w-5 h-5 ${statusStyle.textColor}`} />
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${statusStyle.color}`}></div>
                  <span className={`text-xs font-medium ${statusStyle.textColor}`}>
                    {formatChange(category.trend)}
                  </span>
                </div>
              </div>

              <h4 className="text-sm font-semibold text-gray-700 mb-2">{category.category}</h4>

              <div className="flex items-end justify-between">
                <div>
                  <p className={`text-2xl font-bold ${statusStyle.textColor}`}>{category.score}</p>
                  <p className="text-xs text-gray-500">Target: {category.target}</p>
                </div>

                <div className="w-12 h-12">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" data={[{
                      name: category.category,
                      value: (category.score / 100) * 100,
                      fill: radialData[index].fill
                    }]}>
                      <RadialBar
                        dataKey="value"
                        cornerRadius={2}
                        fill={radialData[index].fill}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detailed Metrics */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700">Detailed Performance Metrics</h4>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.map((category, categoryIndex) => (
            <motion.div
              key={category.category}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: categoryIndex * 0.1 }}
              className="space-y-3"
            >
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${statusConfig[category.status].color}`}></div>
                <h5 className="text-sm font-medium text-gray-700">{category.category}</h5>
              </div>

              <div className="space-y-2">
                {category.metrics.map((metric) => (
                  <div key={metric.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-600">{metric.name}</span>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-semibold">
                        {formatMetricValue(metric.value, metric.unit)}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        metric.change >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {formatChange(metric.change)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Score Distribution</h4>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                <span>{data.filter(d => d.status === 'excellent' || d.status === 'good').length} Good/Excellent</span>
              </div>
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mr-1" />
                <span>{data.filter(d => d.status === 'warning' || d.status === 'critical').length} Need Attention</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Trend Analysis</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Improving Categories:</span>
                <span className="font-medium text-green-600">
                  {data.filter(d => d.trend > 0).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Declining Categories:</span>
                <span className="font-medium text-red-600">
                  {data.filter(d => d.trend < 0).length}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Target Achievement</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Above Target:</span>
                <span className="font-medium text-blue-600">
                  {data.filter(d => d.score >= d.target).length}/{data.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Avg vs Target:</span>
                <span className="font-medium">
                  {formatChange((overallScore - data.reduce((sum, d) => sum + d.target, 0) / data.length) / (data.reduce((sum, d) => sum + d.target, 0) / data.length) * 100)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Last updated: {new Date().toLocaleString()} | Scores updated weekly based on KPI performance
        </div>
      </div>
    </motion.div>
  );
});

OperationalMetrics.displayName = 'OperationalMetrics';

export default OperationalMetrics;