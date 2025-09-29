import React, { memo, useState, useMemo } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';
import { AlertTriangle, Shield, Eye, Clock, Filter, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnomalyPoint {
  timestamp: string;
  value: number;
  expected: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'pattern' | 'drift';
  confidence: number;
  metric: string;
  description: string;
}

interface AnomalyAlert {
  id: string;
  timestamp: string;
  type: 'spike' | 'drop' | 'pattern' | 'drift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  value: number;
  expected: number;
  deviation: number;
  description: string;
  status: 'active' | 'acknowledged' | 'resolved';
  impact: string;
}

interface AnomalyDetectionProps {
  anomalies?: AnomalyPoint[];
  alerts?: AnomalyAlert[];
  isLoading?: boolean;
  className?: string;
  onAlertAcknowledge?: (alertId: string) => void;
}

const mockAnomalies: AnomalyPoint[] = [
  { timestamp: '2024-01-15T09:00:00Z', value: 42.1, expected: 45.2, severity: 'medium', type: 'drop', confidence: 0.87, metric: 'Revenue', description: 'Unexpected revenue drop' },
  { timestamp: '2024-02-03T14:30:00Z', value: 52.8, expected: 48.7, severity: 'low', type: 'spike', confidence: 0.72, metric: 'Revenue', description: 'Positive revenue spike' },
  { timestamp: '2024-02-18T11:15:00Z', value: 34.2, expected: 49.1, severity: 'high', type: 'drop', confidence: 0.94, metric: 'Revenue', description: 'Significant revenue decline' },
  { timestamp: '2024-03-05T16:45:00Z', value: 58.9, expected: 52.1, severity: 'low', type: 'spike', confidence: 0.68, metric: 'Revenue', description: 'Revenue exceeds normal range' },
  { timestamp: '2024-03-22T08:20:00Z', value: 44.3, expected: 51.8, severity: 'medium', type: 'drop', confidence: 0.81, metric: 'Revenue', description: 'Below expected performance' },
  { timestamp: '2024-04-10T13:10:00Z', value: 62.4, expected: 55.2, severity: 'medium', type: 'spike', confidence: 0.89, metric: 'Revenue', description: 'Unusual upward trend' },
];

const mockAlerts: AnomalyAlert[] = [
  {
    id: '1',
    timestamp: '2024-04-10T13:10:00Z',
    type: 'spike',
    severity: 'medium',
    metric: 'Revenue',
    value: 62.4,
    expected: 55.2,
    deviation: 13.0,
    description: 'Revenue spike detected in afternoon trading',
    status: 'active',
    impact: 'Positive - investigate for replication opportunities'
  },
  {
    id: '2',
    timestamp: '2024-04-09T10:30:00Z',
    type: 'pattern',
    severity: 'high',
    metric: 'Customer Churn',
    value: 8.7,
    expected: 5.2,
    deviation: 67.3,
    description: 'Unusual churn pattern in enterprise segment',
    status: 'acknowledged',
    impact: 'Negative - potential customer satisfaction issue'
  },
  {
    id: '3',
    timestamp: '2024-04-08T15:45:00Z',
    type: 'drift',
    severity: 'critical',
    metric: 'Conversion Rate',
    value: 2.1,
    expected: 4.8,
    deviation: -56.3,
    description: 'Gradual conversion rate decline over 5 days',
    status: 'active',
    impact: 'Critical - immediate investigation required'
  },
  {
    id: '4',
    timestamp: '2024-04-07T09:15:00Z',
    type: 'drop',
    severity: 'low',
    metric: 'Page Load Time',
    value: 3.2,
    expected: 2.1,
    deviation: 52.4,
    description: 'Website performance degradation',
    status: 'resolved',
    impact: 'Medium - may affect user experience'
  }
];

const AnomalyDetection: React.FC<AnomalyDetectionProps> = memo(({
  anomalies = mockAnomalies,
  alerts = mockAlerts,
  isLoading = false,
  className = '',
  onAlertAcknowledge
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  const metrics = useMemo(() => {
    const activeAnomalies = anomalies.length;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;
    const resolvedToday = alerts.filter(a => a.status === 'resolved' &&
      new Date(a.timestamp).toDateString() === new Date().toDateString()).length;
    const avgConfidence = anomalies.reduce((sum, a) => sum + a.confidence, 0) / anomalies.length;

    return { activeAnomalies, criticalAlerts, resolvedToday, avgConfidence };
  }, [anomalies, alerts]);

  const filteredAlerts = useMemo(() => {
    return selectedSeverity === 'all'
      ? alerts
      : alerts.filter(alert => alert.severity === selectedSeverity);
  }, [alerts, selectedSeverity]);

  const severityConfig = {
    low: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: '#3B82F6' },
    medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: '#F59E0B' },
    high: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', dot: '#EA580C' },
    critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', dot: '#DC2626' }
  };

  const typeIcons = {
    spike: TrendingUp,
    drop: TrendingDown,
    pattern: Eye,
    drift: AlertCircle
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
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDeviation = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  // Prepare chart data
  const chartData = anomalies.map((anomaly, index) => ({
    x: index,
    y: Math.abs(((anomaly.value - anomaly.expected) / anomaly.expected) * 100),
    severity: anomaly.severity,
    type: anomaly.type,
    description: anomaly.description,
    timestamp: anomaly.timestamp
  }));

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
          <h3 className="text-lg font-semibold text-gray-900">Anomaly Detection</h3>
          <p className="text-sm text-gray-600">Real-time anomaly monitoring and alerts</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <Shield className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex space-x-2">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  timeRange === range
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-100"
        >
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">
              Critical
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Active Alerts</p>
          <p className="text-2xl font-bold text-red-700">{metrics.criticalAlerts}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Eye className="w-5 h-5 text-yellow-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
              Total
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Anomalies Detected</p>
          <p className="text-2xl font-bold text-yellow-700">{metrics.activeAnomalies}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
              Today
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Resolved</p>
          <p className="text-2xl font-bold text-green-700">{metrics.resolvedToday}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              Avg
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Detection Confidence</p>
          <p className="text-2xl font-bold text-blue-700">{(metrics.avgConfidence * 100).toFixed(1)}%</p>
        </motion.div>
      </div>

      {/* Anomaly Scatter Plot */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Anomaly Severity Distribution</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                type="number"
                dataKey="x"
                domain={['dataMin', 'dataMax']}
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Deviation']}
                labelFormatter={(value: number) => `Point ${value + 1}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Scatter dataKey="y" name="Deviation">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={severityConfig[entry.severity as keyof typeof severityConfig].dot} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Recent Alerts</h4>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {filteredAlerts.map((alert, index) => {
            const severityStyle = severityConfig[alert.severity];
            const TypeIcon = typeIcons[alert.type];
            const isSelected = selectedAlert === alert.id;

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  isSelected ? 'border-amber-300 bg-amber-50' : `${severityStyle.border} ${severityStyle.bg} hover:bg-opacity-60`
                }`}
                onClick={() => setSelectedAlert(isSelected ? null : alert.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      <TypeIcon className={`w-5 h-5 ${severityStyle.color}`} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">{alert.metric}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityStyle.color} ${severityStyle.bg}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          alert.status === 'active' ? 'bg-red-100 text-red-700' :
                          alert.status === 'acknowledged' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {alert.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{alert.description}</p>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-4">
                          <span>{formatTimestamp(alert.timestamp)}</span>
                          <span>Value: {alert.value}</span>
                          <span>Expected: {alert.expected}</span>
                          <span className={`font-medium ${
                            alert.deviation > 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatDeviation(alert.deviation)}
                          </span>
                        </div>
                        {alert.status === 'active' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onAlertAcknowledge?.(alert.id);
                            }}
                            className="text-amber-600 hover:text-amber-700 font-medium"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="mt-3 pt-3 border-t border-gray-200"
                    >
                      <h6 className="text-xs font-semibold text-gray-700 mb-1">Impact Analysis</h6>
                      <p className="text-xs text-gray-600">{alert.impact}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Critical</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>High</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Low</span>
            </div>
          </div>
          <span>Last scan: {formatTimestamp(new Date().toISOString())}</span>
        </div>
      </div>
    </motion.div>
  );
});

AnomalyDetection.displayName = 'AnomalyDetection';

export default AnomalyDetection;