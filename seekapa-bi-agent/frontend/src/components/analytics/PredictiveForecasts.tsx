import React, { memo, useState, useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { TrendingUp, Target, Calendar, Activity, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

interface ForecastData {
  period: string;
  historical?: number;
  predicted: number;
  confidence_lower: number;
  confidence_upper: number;
  factors: {
    seasonality: number;
    trend: number;
    external: number;
  };
}

interface ForecastScenario {
  name: string;
  probability: number;
  impact: number;
  description: string;
}

interface PredictiveForecastsProps {
  data?: ForecastData[];
  scenarios?: ForecastScenario[];
  isLoading?: boolean;
  className?: string;
  timeframe?: '3M' | '6M' | '1Y';
  onTimeframeChange?: (timeframe: '3M' | '6M' | '1Y') => void;
}

const mockData: ForecastData[] = [
  // Historical data (last 6 months)
  { period: 'Jan', historical: 45.2, predicted: 45.2, confidence_lower: 44.1, confidence_upper: 46.3, factors: { seasonality: 0.8, trend: 1.2, external: 0.9 } },
  { period: 'Feb', historical: 48.7, predicted: 48.7, confidence_lower: 47.5, confidence_upper: 49.9, factors: { seasonality: 1.1, trend: 1.3, external: 1.0 } },
  { period: 'Mar', historical: 52.1, predicted: 52.1, confidence_lower: 50.8, confidence_upper: 53.4, factors: { seasonality: 1.2, trend: 1.4, external: 1.1 } },
  { period: 'Apr', historical: 49.3, predicted: 49.3, confidence_lower: 48.0, confidence_upper: 50.6, factors: { seasonality: 0.9, trend: 1.3, external: 0.8 } },
  { period: 'May', historical: 55.8, predicted: 55.8, confidence_lower: 54.3, confidence_upper: 57.3, factors: { seasonality: 1.3, trend: 1.5, external: 1.2 } },
  { period: 'Jun', historical: 58.2, predicted: 58.2, confidence_lower: 56.6, confidence_upper: 59.8, factors: { seasonality: 1.4, trend: 1.6, external: 1.1 } },
  // Forecast data (next 6 months)
  { period: 'Jul', predicted: 61.5, confidence_lower: 58.9, confidence_upper: 64.1, factors: { seasonality: 1.5, trend: 1.7, external: 1.0 } },
  { period: 'Aug', predicted: 64.2, confidence_lower: 60.8, confidence_upper: 67.6, factors: { seasonality: 1.4, trend: 1.8, external: 1.1 } },
  { period: 'Sep', predicted: 67.8, confidence_lower: 63.2, confidence_upper: 72.4, factors: { seasonality: 1.6, trend: 1.9, external: 1.2 } },
  { period: 'Oct', predicted: 65.4, confidence_lower: 60.1, confidence_upper: 70.7, factors: { seasonality: 1.2, trend: 1.8, external: 0.9 } },
  { period: 'Nov', predicted: 69.1, confidence_lower: 63.5, confidence_upper: 74.7, factors: { seasonality: 1.3, trend: 2.0, external: 1.0 } },
  { period: 'Dec', predicted: 72.6, confidence_lower: 66.2, confidence_upper: 79.0, factors: { seasonality: 1.5, trend: 2.1, external: 1.1 } },
];

const mockScenarios: ForecastScenario[] = [
  { name: 'Optimistic', probability: 25, impact: 15, description: 'Market expansion success + new product launch' },
  { name: 'Likely', probability: 50, impact: 8, description: 'Current trends continue with normal seasonal variation' },
  { name: 'Conservative', probability: 20, impact: -5, description: 'Market slowdown due to external factors' },
  { name: 'Pessimistic', probability: 5, impact: -15, description: 'Significant market disruption or recession' }
];

const PredictiveForecasts: React.FC<PredictiveForecastsProps> = memo(({
  data = mockData,
  scenarios = mockScenarios,
  isLoading = false,
  className = '',
  timeframe = '6M',
  onTimeframeChange
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('Likely');
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);

  const metrics = useMemo(() => {
    if (!data.length) return {
      forecastGrowth: 0,
      confidenceRange: 0,
      nextPeriodForecast: 0,
      avgConfidence: 0
    };

    const forecastData = data.filter(d => !d.historical);
    const lastHistorical = data.filter(d => d.historical).slice(-1)[0];
    const nextPeriod = forecastData[0];

    const forecastGrowth = lastHistorical && nextPeriod
      ? ((nextPeriod.predicted - lastHistorical.historical!) / lastHistorical.historical!) * 100
      : 0;

    const avgConfidenceRange = forecastData.reduce((sum, item) => {
      return sum + ((item.confidence_upper - item.confidence_lower) / item.predicted) * 100;
    }, 0) / forecastData.length;

    const avgConfidence = 100 - avgConfidenceRange;

    return {
      forecastGrowth,
      confidenceRange: avgConfidenceRange,
      nextPeriodForecast: nextPeriod?.predicted || 0,
      avgConfidence
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `$${value.toFixed(1)}M`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatPercentChange = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

  const adjustedData = useMemo(() => {
    const selectedScenarioData = scenarios.find(s => s.name === selectedScenario);
    if (!selectedScenarioData) return data;

    const impactMultiplier = 1 + (selectedScenarioData.impact / 100);
    return data.map(item => ({
      ...item,
      predicted: item.predicted * impactMultiplier,
      confidence_lower: item.confidence_lower * impactMultiplier,
      confidence_upper: item.confidence_upper * impactMultiplier
    }));
  }, [data, selectedScenario, scenarios]);

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
          <h3 className="text-lg font-semibold text-gray-900">Predictive Revenue Forecasts</h3>
          <p className="text-sm text-gray-600">AI-powered revenue and demand forecasting</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <Activity className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex space-x-2">
            {(['3M', '6M', '1Y'] as const).map((period) => (
              <button
                key={period}
                onClick={() => onTimeframeChange?.(period)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  timeframe === period
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              metrics.forecastGrowth >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {formatPercentChange(metrics.forecastGrowth)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Next Period Growth</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(metrics.nextPeriodForecast)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              Model
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Forecast Confidence</p>
          <p className="text-xl font-bold text-blue-700">{formatPercent(metrics.avgConfidence)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700">
              Range
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Confidence Band</p>
          <p className="text-xl font-bold text-purple-700">±{formatPercent(metrics.confidenceRange)}</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Settings className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              {selectedScenario}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Scenario Impact</p>
          <p className="text-xl font-bold text-amber-700">
            {formatPercentChange(scenarios.find(s => s.name === selectedScenario)?.impact || 0)}
          </p>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showConfidenceBands}
              onChange={(e) => setShowConfidenceBands(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-600">Show confidence bands</span>
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Scenario:</span>
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
          >
            {scenarios.map(scenario => (
              <option key={scenario.name} value={scenario.name}>
                {scenario.name} ({scenario.probability}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={adjustedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1}/>
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

            {/* Confidence bands */}
            {showConfidenceBands && (
              <Area
                type="monotone"
                dataKey="confidence_upper"
                stroke="none"
                fill="url(#confidenceBand)"
                name="Upper Confidence"
              />
            )}
            {showConfidenceBands && (
              <Area
                type="monotone"
                dataKey="confidence_lower"
                stroke="none"
                fill="white"
                name="Lower Confidence"
              />
            )}

            {/* Historical data line */}
            <Line
              type="monotone"
              dataKey="historical"
              stroke="#374151"
              strokeWidth={3}
              dot={{ fill: '#374151', strokeWidth: 2, r: 4 }}
              connectNulls={false}
              name="Historical"
            />

            {/* Forecast line */}
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#F59E0B"
              strokeWidth={3}
              strokeDasharray="8 4"
              dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
              name="Forecast"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Forecast Scenarios</h4>
          <div className="space-y-2">
            {scenarios.map((scenario, index) => (
              <motion.div
                key={scenario.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedScenario === scenario.name
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                }`}
                onClick={() => setSelectedScenario(scenario.name)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{scenario.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500">{scenario.probability}%</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      scenario.impact >= 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {formatPercentChange(scenario.impact)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">{scenario.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Forecast Factors</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Seasonality Impact</span>
              <span className="text-sm font-medium">High</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Trend Strength</span>
              <span className="text-sm font-medium">Strong Upward</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">External Factors</span>
              <span className="text-sm font-medium">Moderate Positive</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm text-gray-600">Model Accuracy</span>
              <span className="text-sm font-medium">87.3%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Model: ARIMA + ML Ensemble</span>
            <span>•</span>
            <span>Training data: 36 months</span>
            <span>•</span>
            <span>Last retrained: {new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
          </div>
          <span>Updated every 6 hours</span>
        </div>
      </div>
    </motion.div>
  );
});

PredictiveForecasts.displayName = 'PredictiveForecasts';

export default PredictiveForecasts;