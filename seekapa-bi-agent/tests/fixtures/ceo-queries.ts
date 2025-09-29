/**
 * CEO-Focused Test Queries for Seekapa BI Agent
 * 10 comprehensive business intelligence queries for executive validation
 */

import { CEOQuery } from '../types';

export const CEO_QUERIES: CEOQuery[] = [
  {
    id: 'q1_revenue_kpi',
    description: 'KPI Dashboard Query - Revenue Performance',
    query: 'What was our revenue last quarter?',
    expectedModel: 'gpt-5-mini',
    expectedResponseTime: 2000,
    category: 'kpi',
    validation: {
      contentMustInclude: [
        'revenue',
        'quarter',
        '$',
        '%',
        'performance'
      ],
      contentMustNotInclude: [
        'error',
        'unable',
        'cannot'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'kpi-card',
        'revenue-chart',
        'percentage-change'
      ],
      businessMetrics: [
        'quarterly_revenue',
        'growth_rate',
        'comparison_period'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q2_sales_trends',
    description: 'Trend Analysis - Sales Performance Over Time',
    query: 'Show me sales trends for the past 6 months',
    expectedModel: 'gpt-5-chat',
    expectedResponseTime: 2500,
    category: 'trend',
    validation: {
      contentMustInclude: [
        'sales',
        'trend',
        'months',
        'growth',
        'period'
      ],
      contentMustNotInclude: [
        'insufficient data',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'trend-chart',
        'time-axis',
        'data-points'
      ],
      businessMetrics: [
        'monthly_sales',
        'trend_direction',
        'growth_rate'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q3_yoy_comparison',
    description: 'Comparative Analysis - Year-over-Year Performance',
    query: 'Compare Q3 2025 vs Q3 2024 performance',
    expectedModel: 'gpt-5-full',
    expectedResponseTime: 3000,
    category: 'comparison',
    validation: {
      contentMustInclude: [
        'Q3',
        '2025',
        '2024',
        'compare',
        'performance',
        'year-over-year'
      ],
      contentMustNotInclude: [
        'data not available',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'comparison-chart',
        'yoy-metrics',
        'variance-indicators'
      ],
      businessMetrics: [
        'yoy_growth',
        'performance_variance',
        'key_indicators'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q4_revenue_forecast',
    description: 'Predictive Forecasting - Q4 Revenue Projection',
    query: 'Predict Q4 revenue based on current trends',
    expectedModel: 'gpt-5-full',
    expectedResponseTime: 3000,
    category: 'forecast',
    validation: {
      contentMustInclude: [
        'forecast',
        'Q4',
        'revenue',
        'predict',
        'trends',
        'projection'
      ],
      contentMustNotInclude: [
        'cannot predict',
        'insufficient data'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'forecast-chart',
        'confidence-intervals',
        'trend-projection'
      ],
      businessMetrics: [
        'forecasted_revenue',
        'confidence_level',
        'trend_basis'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q5_anomaly_detection',
    description: 'Anomaly Detection - Sales Data Analysis',
    query: 'Detect any anomalies in our sales data',
    expectedModel: 'gpt-5-full',
    expectedResponseTime: 2500,
    category: 'anomaly',
    validation: {
      contentMustInclude: [
        'anomaly',
        'anomalies',
        'sales data',
        'detect',
        'analysis'
      ],
      contentMustNotInclude: [
        'no data available',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'anomaly-indicators',
        'data-timeline',
        'alert-markers'
      ],
      businessMetrics: [
        'anomaly_count',
        'severity_score',
        'affected_periods'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q6_executive_report',
    description: 'Report Generation - Executive Summary',
    query: 'Generate an executive summary report',
    expectedModel: 'gpt-5-chat',
    expectedResponseTime: 2500,
    category: 'report',
    validation: {
      contentMustInclude: [
        'executive summary',
        'report',
        'key findings',
        'recommendations',
        'performance'
      ],
      contentMustNotInclude: [
        'unable to generate',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'report-sections',
        'summary-cards',
        'key-metrics'
      ],
      businessMetrics: [
        'summary_metrics',
        'key_insights',
        'action_items'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q7_product_performance',
    description: 'Natural Language Analysis - Product Performance',
    query: 'Which products are underperforming this quarter?',
    expectedModel: 'gpt-5-mini',
    expectedResponseTime: 2000,
    category: 'natural',
    validation: {
      contentMustInclude: [
        'products',
        'underperforming',
        'quarter',
        'performance',
        'analysis'
      ],
      contentMustNotInclude: [
        'no product data',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'product-list',
        'performance-indicators',
        'ranking-table'
      ],
      businessMetrics: [
        'product_performance',
        'underperformer_count',
        'performance_scores'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q8_realtime_metrics',
    description: 'Real-Time Data - Customer Acquisition',
    query: 'Show me real-time customer acquisition metrics',
    expectedModel: 'gpt-5-nano',
    expectedResponseTime: 1500,
    category: 'realtime',
    validation: {
      contentMustInclude: [
        'real-time',
        'customer acquisition',
        'metrics',
        'current',
        'live'
      ],
      contentMustNotInclude: [
        'data not available',
        'error'
      ],
      responseTimeMax: 2000,
      visualElements: [
        'realtime-dashboard',
        'live-counters',
        'refresh-indicators'
      ],
      businessMetrics: [
        'acquisition_rate',
        'current_metrics',
        'live_data'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q9_export_dashboard',
    description: 'Export Functionality - KPI Dashboard Export',
    query: 'Export the latest KPI dashboard to PowerPoint',
    expectedModel: 'gpt-5-mini',
    expectedResponseTime: 2000,
    category: 'export',
    validation: {
      contentMustInclude: [
        'export',
        'KPI dashboard',
        'PowerPoint',
        'download',
        'presentation'
      ],
      contentMustNotInclude: [
        'export not available',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'export-dialog',
        'format-options',
        'download-button'
      ],
      businessMetrics: [
        'export_format',
        'dashboard_data',
        'presentation_ready'
      ],
      executiveLanguage: true
    }
  },

  {
    id: 'q10_mobile_performance',
    description: 'Mobile Responsiveness - Performance Overview',
    query: 'How does our performance look?',
    expectedModel: 'gpt-5-mini',
    expectedResponseTime: 2000,
    category: 'mobile',
    validation: {
      contentMustInclude: [
        'performance',
        'overview',
        'metrics',
        'summary',
        'current'
      ],
      contentMustNotInclude: [
        'data unavailable',
        'error'
      ],
      responseTimeMax: 3000,
      visualElements: [
        'mobile-dashboard',
        'touch-elements',
        'responsive-charts'
      ],
      businessMetrics: [
        'overall_performance',
        'key_indicators',
        'summary_stats'
      ],
      executiveLanguage: true
    }
  }
];

/**
 * Get queries by category
 */
export function getQueriesByCategory(category: CEOQuery['category']): CEOQuery[] {
  return CEO_QUERIES.filter(query => query.category === category);
}

/**
 * Get query by ID
 */
export function getQueryById(id: string): CEOQuery | undefined {
  return CEO_QUERIES.find(query => query.id === id);
}

/**
 * Get all query categories
 */
export function getAllCategories(): CEOQuery['category'][] {
  return [...new Set(CEO_QUERIES.map(query => query.category))];
}

/**
 * Validate query response against criteria
 */
export function validateQueryResponse(
  query: CEOQuery,
  responseContent: string,
  responseTime: number,
  modelUsed: string
): {
  passed: boolean;
  score: number;
  issues: string[];
  details: Record<string, boolean>;
} {
  const issues: string[] = [];
  const details: Record<string, boolean> = {};

  // Check response time
  const timeOk = responseTime <= query.validation.responseTimeMax;
  details.responseTime = timeOk;
  if (!timeOk) {
    issues.push(`Response time ${responseTime}ms exceeds maximum ${query.validation.responseTimeMax}ms`);
  }

  // Check required content
  const contentLower = responseContent.toLowerCase();
  const hasAllRequired = query.validation.contentMustInclude.every(term => {
    const found = contentLower.includes(term.toLowerCase());
    details[`content_includes_${term}`] = found;
    if (!found) {
      issues.push(`Missing required content: "${term}"`);
    }
    return found;
  });

  // Check forbidden content
  const hasForbidden = query.validation.contentMustNotInclude?.some(term => {
    const found = contentLower.includes(term.toLowerCase());
    details[`content_excludes_${term}`] = !found;
    if (found) {
      issues.push(`Contains forbidden content: "${term}"`);
    }
    return found;
  }) || false;

  // Check model selection (approximate - allow flexibility)
  const modelOk = modelUsed.toLowerCase().includes(query.expectedModel.toLowerCase()) ||
                  Math.abs(responseTime - query.expectedResponseTime) <= 1000;
  details.modelSelection = modelOk;
  if (!modelOk) {
    issues.push(`Expected model ${query.expectedModel}, got ${modelUsed}`);
  }

  // Check executive language quality
  const executiveTerms = ['revenue', 'performance', 'growth', 'analysis', 'metrics', 'insights', 'recommendations'];
  const hasExecutiveLanguage = executiveTerms.some(term => contentLower.includes(term));
  details.executiveLanguage = hasExecutiveLanguage;
  if (!hasExecutiveLanguage) {
    issues.push('Response lacks executive-level business terminology');
  }

  // Calculate overall score
  const totalChecks = Object.keys(details).length;
  const passedChecks = Object.values(details).filter(passed => passed).length;
  const score = Math.round((passedChecks / totalChecks) * 100);

  return {
    passed: issues.length === 0,
    score,
    issues,
    details
  };
}