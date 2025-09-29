import React, { memo, useState, useMemo } from 'react';
import { Brain, TrendingUp, AlertCircle, Target, ChevronRight, Lightbulb, BarChart3, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InsightData {
  id: string;
  type: 'opportunity' | 'risk' | 'achievement' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  actionable: boolean;
  confidence: number;
  timeframe: string;
  metrics?: {
    name: string;
    value: string;
    change?: string;
  }[];
}

interface ExecutiveSummaryProps {
  insights?: InsightData[];
  isLoading?: boolean;
  className?: string;
  onInsightClick?: (insight: InsightData) => void;
}

const mockInsights: InsightData[] = [
  {
    id: '1',
    type: 'opportunity',
    title: 'Revenue Acceleration Potential',
    description: 'Q3 revenue trajectory indicates potential for 15-18% quarter-over-quarter growth if current customer acquisition trends continue.',
    impact: 'high',
    category: 'Revenue',
    actionable: true,
    confidence: 87,
    timeframe: 'Next 3 months',
    metrics: [
      { name: 'Projected Revenue', value: '$67.2M', change: '+15.8%' },
      { name: 'Customer Growth', value: '23%', change: '+8.2%' }
    ]
  },
  {
    id: '2',
    type: 'risk',
    title: 'Cash Flow Optimization Required',
    description: 'Current burn rate suggests need for working capital optimization. Recommend accelerating collections and renegotiating payment terms.',
    impact: 'medium',
    category: 'Cash Flow',
    actionable: true,
    confidence: 92,
    timeframe: 'Next 6 weeks',
    metrics: [
      { name: 'Days Sales Outstanding', value: '45 days', change: '+12%' },
      { name: 'Cash Runway', value: '14.2 months' }
    ]
  },
  {
    id: '3',
    type: 'achievement',
    title: 'Operational Excellence Milestone',
    description: 'Team performance scores exceeded targets by 8.5%, marking highest operational efficiency quarter in company history.',
    impact: 'high',
    category: 'Operations',
    actionable: false,
    confidence: 95,
    timeframe: 'Current quarter',
    metrics: [
      { name: 'Efficiency Score', value: '87/100', change: '+8.5%' },
      { name: 'Process Automation', value: '78%', change: '+12%' }
    ]
  },
  {
    id: '4',
    type: 'recommendation',
    title: 'Market Expansion Strategy',
    description: 'Data indicates strong market receptivity for European expansion. Recommend pilot program in DACH region by Q4.',
    impact: 'high',
    category: 'Growth',
    actionable: true,
    confidence: 78,
    timeframe: 'Next quarter',
    metrics: [
      { name: 'Market Opportunity', value: '$45M', change: 'TAM' },
      { name: 'Competition Density', value: 'Low-Medium' }
    ]
  }
];

const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = memo(({
  insights = mockInsights,
  isLoading = false,
  className = '',
  onInsightClick
}) => {
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'actionable'>('all');

  const filteredInsights = useMemo(() => {
    return filter === 'actionable'
      ? insights.filter(insight => insight.actionable)
      : insights;
  }, [insights, filter]);

  const insightCounts = useMemo(() => {
    return {
      opportunities: insights.filter(i => i.type === 'opportunity').length,
      risks: insights.filter(i => i.type === 'risk').length,
      achievements: insights.filter(i => i.type === 'achievement').length,
      recommendations: insights.filter(i => i.type === 'recommendation').length,
      actionable: insights.filter(i => i.actionable).length
    };
  }, [insights]);

  const typeConfig = {
    opportunity: {
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: 'Opportunity'
    },
    risk: {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: 'Risk'
    },
    achievement: {
      icon: Target,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      label: 'Achievement'
    },
    recommendation: {
      icon: Lightbulb,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      label: 'Recommendation'
    }
  };

  const impactConfig = {
    high: { color: 'text-red-600', bg: 'bg-red-100' },
    medium: { color: 'text-yellow-600', bg: 'bg-yellow-100' },
    low: { color: 'text-green-600', bg: 'bg-green-100' }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handleInsightClick = (insight: InsightData) => {
    setSelectedInsight(selectedInsight === insight.id ? null : insight.id);
    onInsightClick?.(insight);
  };

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
          <h3 className="text-lg font-semibold text-gray-900">Executive AI Insights</h3>
          <p className="text-sm text-gray-600">AI-generated strategic recommendations and alerts</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-50 rounded-full">
            <Brain className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === 'all'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({insights.length})
            </button>
            <button
              onClick={() => setFilter('actionable')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filter === 'actionable'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Actionable ({insightCounts.actionable})
            </button>
          </div>
        </div>
      </div>

      {/* Insight Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Opportunities</p>
              <p className="text-2xl font-bold text-green-700">{insightCounts.opportunities}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-lg border border-red-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Risks</p>
              <p className="text-2xl font-bold text-red-700">{insightCounts.risks}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Achievements</p>
              <p className="text-2xl font-bold text-blue-700">{insightCounts.achievements}</p>
            </div>
            <Target className="w-8 h-8 text-blue-600" />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recommendations</p>
              <p className="text-2xl font-bold text-amber-700">{insightCounts.recommendations}</p>
            </div>
            <Lightbulb className="w-8 h-8 text-amber-600" />
          </div>
        </motion.div>
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
          <BarChart3 className="w-4 h-4 mr-2" />
          Strategic Insights
        </h4>

        <div className="space-y-3">
          {filteredInsights.map((insight, index) => {
            const config = typeConfig[insight.type];
            const IconComponent = config.icon;
            const isExpanded = selectedInsight === insight.id;

            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className={`border rounded-lg ${config.border} ${config.bg} cursor-pointer transition-all duration-200 hover:shadow-md`}
                onClick={() => handleInsightClick(insight)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0">
                        <IconComponent className={`w-5 h-5 ${config.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h5 className="text-sm font-semibold text-gray-900">{insight.title}</h5>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color} ${config.bg}`}>
                            {config.label}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            impactConfig[insight.impact].color
                          } ${impactConfig[insight.impact].bg}`}>
                            {insight.impact.toUpperCase()}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-2">{insight.description}</p>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center space-x-4">
                            <span>Category: {insight.category}</span>
                            <span>Confidence: {insight.confidence}%</span>
                            <span>Timeframe: {insight.timeframe}</span>
                          </div>
                          {insight.actionable && (
                            <div className="flex items-center space-x-1 text-amber-600">
                              <span>Actionable</span>
                              <ArrowRight className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </div>

                  <AnimatePresence>
                    {isExpanded && insight.metrics && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-4 pt-4 border-t border-gray-200"
                      >
                        <h6 className="text-xs font-semibold text-gray-700 mb-2">Key Metrics</h6>
                        <div className="grid grid-cols-2 gap-3">
                          {insight.metrics.map((metric, metricIndex) => (
                            <div key={metricIndex} className="bg-white bg-opacity-50 p-2 rounded">
                              <p className="text-xs text-gray-600">{metric.name}</p>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-semibold">{metric.value}</span>
                                {metric.change && (
                                  <span className={`text-xs font-medium px-1 py-0.5 rounded ${
                                    metric.change.startsWith('+')
                                      ? 'bg-green-100 text-green-700'
                                      : metric.change.startsWith('-')
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {metric.change}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>AI Analysis powered by GPT-5</span>
            <span>•</span>
            <span>Confidence avg: {Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length)}%</span>
          </div>
          <span>Last updated: {new Date().toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
});

ExecutiveSummary.displayName = 'ExecutiveSummary';

export default ExecutiveSummary;