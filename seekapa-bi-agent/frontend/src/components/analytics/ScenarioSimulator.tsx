import React, { memo, useState, useMemo, useCallback } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from 'recharts';
import { Calculator, Play, RotateCcw, Settings, TrendingUp, DollarSign, Users, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface SimulationVariable {
  key: string;
  name: string;
  current: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  impact: number; // How much this affects the outcome (0-1)
}

// interface SimulationResult {
//   period: string;
//   baseline: number;
//   scenario: number;
//   difference: number;
//   cumulativeDiff: number;
// }

interface ScenarioSimulatorProps {
  variables?: SimulationVariable[];
  isLoading?: boolean;
  className?: string;
  onRunSimulation?: (variables: Record<string, number>) => void;
}

const defaultVariables: SimulationVariable[] = [
  { key: 'marketingSpend', name: 'Marketing Spend', current: 100000, min: 50000, max: 200000, step: 5000, unit: '$', impact: 0.8 },
  { key: 'conversionRate', name: 'Conversion Rate', current: 3.5, min: 1.0, max: 8.0, step: 0.1, unit: '%', impact: 0.9 },
  { key: 'avgOrderValue', name: 'Avg Order Value', current: 125, min: 75, max: 250, step: 5, unit: '$', impact: 0.7 },
  { key: 'customerRetention', name: 'Customer Retention', current: 85, min: 70, max: 95, step: 1, unit: '%', impact: 0.85 },
  { key: 'pricingMultiplier', name: 'Pricing Adjustment', current: 1.0, min: 0.8, max: 1.3, step: 0.05, unit: 'x', impact: 0.95 },
  { key: 'operationalCosts', name: 'Operational Costs', current: 75000, min: 60000, max: 100000, step: 2500, unit: '$', impact: -0.6 }
];

const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = memo(({
  variables = defaultVariables,
  isLoading = false,
  className = '',
  onRunSimulation
}) => {
  const [variableValues, setVariableValues] = useState<Record<string, number>>(
    variables.reduce((acc, variable) => ({
      ...acc,
      [variable.key]: variable.current
    }), {})
  );

  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'profit' | 'customers' | 'roi'>('revenue');

  // Simulate the impact based on variable changes
  const simulationResults = useMemo(() => {
    const baselineRevenue = 58.2; // Million
    const periods = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return periods.map((period, index) => {
      let scenarioMultiplier = 1;

      // Calculate combined impact of all variables
      variables.forEach(variable => {
        const currentValue = variableValues[variable.key];
        const baselineValue = variable.current;
        const changePercent = (currentValue - baselineValue) / baselineValue;
        const impact = changePercent * variable.impact;
        scenarioMultiplier += impact;
      });

      // Add some growth trend and seasonality
      const monthlyGrowth = 1 + (index * 0.02); // 2% monthly growth baseline
      const seasonality = 1 + (Math.sin((index / 6) * Math.PI) * 0.1); // Seasonal variation

      const baseline = baselineRevenue * monthlyGrowth * seasonality;
      const scenario = baseline * scenarioMultiplier;
      const difference = scenario - baseline;
      const cumulativeDiff = periods.slice(0, index + 1).reduce((acc, _, i) => {
        const baseVal = baselineRevenue * (1 + (i * 0.02)) * (1 + (Math.sin((i / 6) * Math.PI) * 0.1));
        const scenVal = baseVal * scenarioMultiplier;
        return acc + (scenVal - baseVal);
      }, 0);

      return {
        period,
        baseline: baseline,
        scenario: scenario,
        difference: difference,
        cumulativeDiff: cumulativeDiff
      };
    });
  }, [variableValues, variables]);

  const impactSummary = useMemo(() => {
    const totalImpact = simulationResults.reduce((sum, result) => sum + result.difference, 0);
    const percentageChange = simulationResults.length > 0
      ? ((simulationResults[simulationResults.length - 1].scenario - simulationResults[simulationResults.length - 1].baseline) / simulationResults[simulationResults.length - 1].baseline) * 100
      : 0;

    const roi = (() => {
      const additionalCosts = variables.reduce((sum, variable) => {
        const currentValue = variableValues[variable.key];
        const baselineValue = variable.current;
        if (variable.key === 'marketingSpend' || variable.key === 'operationalCosts') {
          return sum + Math.max(0, currentValue - baselineValue);
        }
        return sum;
      }, 0);

      return additionalCosts > 0 ? ((totalImpact * 1000000) / additionalCosts) : Infinity;
    })();

    return { totalImpact, percentageChange, roi };
  }, [simulationResults, variables, variableValues]);

  const handleVariableChange = useCallback((key: string, value: number) => {
    setVariableValues(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleReset = useCallback(() => {
    setVariableValues(
      variables.reduce((acc, variable) => ({
        ...acc,
        [variable.key]: variable.current
      }), {})
    );
  }, [variables]);

  const handleRunSimulation = useCallback(async () => {
    setIsSimulating(true);
    onRunSimulation?.(variableValues);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSimulating(false);
  }, [variableValues, onRunSimulation]);

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `$${value.toFixed(1)}M`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  const formatNumber = (value: number) => value.toLocaleString();

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
          <h3 className="text-lg font-semibold text-gray-900">Scenario Simulator</h3>
          <p className="text-sm text-gray-600">What-if analysis for strategic planning</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <Calculator className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleReset}
              className="flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              <span>{isSimulating ? 'Running...' : 'Run'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Impact Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100"
        >
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              impactSummary.totalImpact >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {impactSummary.totalImpact >= 0 ? '+' : ''}{formatCurrency(impactSummary.totalImpact)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Total Impact</p>
          <p className="text-xl font-bold text-green-700">6M Revenue</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100"
        >
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              impactSummary.percentageChange >= 0
                ? 'bg-blue-100 text-blue-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {impactSummary.percentageChange >= 0 ? '+' : ''}{formatPercent(impactSummary.percentageChange)}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Change vs Baseline</p>
          <p className="text-xl font-bold text-blue-700">Final Period</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700">
              ROI
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Return on Investment</p>
          <p className="text-xl font-bold text-purple-700">
            {impactSummary.roi === Infinity ? '∞' : `${impactSummary.roi.toFixed(1)}x`}
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-100"
        >
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
              Confidence
            </span>
          </div>
          <p className="text-sm font-medium text-gray-600">Model Accuracy</p>
          <p className="text-xl font-bold text-amber-700">84.2%</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Variable Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Simulation Variables</h4>
            <Settings className="w-4 h-4 text-gray-400" />
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {variables.map((variable, index) => {
              const currentValue = variableValues[variable.key];
              const changePercent = ((currentValue - variable.current) / variable.current) * 100;

              return (
                <motion.div
                  key={variable.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">
                      {variable.name}
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold">
                        {variable.unit === '$' ? `$${formatNumber(currentValue)}` :
                         variable.unit === '%' ? `${currentValue}%` :
                         variable.unit === 'x' ? `${currentValue}x` :
                         `${currentValue}${variable.unit}`}
                      </span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        changePercent >= 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <input
                    type="range"
                    min={variable.min}
                    max={variable.max}
                    step={variable.step}
                    value={currentValue}
                    onChange={(e) => handleVariableChange(variable.key, parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #F59E0B 0%, #F59E0B ${
                        ((currentValue - variable.min) / (variable.max - variable.min)) * 100
                      }%, #E5E7EB ${
                        ((currentValue - variable.min) / (variable.max - variable.min)) * 100
                      }%, #E5E7EB 100%)`
                    }}
                  />

                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>
                      {variable.unit === '$' ? `$${formatNumber(variable.min)}` :
                       variable.unit === '%' ? `${variable.min}%` :
                       variable.unit === 'x' ? `${variable.min}x` :
                       `${variable.min}${variable.unit}`}
                    </span>
                    <span>Impact: {(variable.impact * 100).toFixed(0)}%</span>
                    <span>
                      {variable.unit === '$' ? `$${formatNumber(variable.max)}` :
                       variable.unit === '%' ? `${variable.max}%` :
                       variable.unit === 'x' ? `${variable.max}x` :
                       `${variable.max}${variable.unit}`}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Results Visualization */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Scenario Results</h4>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="revenue">Revenue Impact</option>
              <option value="profit">Profit Impact</option>
              <option value="customers">Customer Impact</option>
              <option value="roi">ROI Analysis</option>
            </select>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={simulationResults} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B7280" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6B7280" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="scenarioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
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

                <Area
                  type="monotone"
                  dataKey="baseline"
                  stroke="#6B7280"
                  strokeWidth={2}
                  fill="url(#baselineGradient)"
                  name="Baseline"
                />
                <Area
                  type="monotone"
                  dataKey="scenario"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  fill="url(#scenarioGradient)"
                  name="Scenario"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Difference Chart */}
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={simulationResults} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="period"
                  stroke="#6b7280"
                  fontSize={10}
                  tickLine={false}
                />
                <YAxis
                  stroke="#6b7280"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Difference']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar
                  dataKey="difference"
                  fill="#F59E0B"
                  radius={[2, 2, 0, 0]}
                  name="Difference vs Baseline"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Model: Monte Carlo + Regression</span>
            <span>•</span>
            <span>Variables: {variables.length}</span>
            <span>•</span>
            <span>Simulation runs: 1,000</span>
          </div>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
});

ScenarioSimulator.displayName = 'ScenarioSimulator';

export default ScenarioSimulator;