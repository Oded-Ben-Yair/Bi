/**
 * TypeScript types for Seekapa BI Agent Testing
 * Ensures type safety for CEO-focused query testing
 */

export interface CEOQuery {
  id: string;
  description: string;
  query: string;
  expectedModel: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5-chat' | 'gpt-5-full';
  expectedResponseTime: number; // milliseconds
  category: 'kpi' | 'trend' | 'comparison' | 'forecast' | 'anomaly' | 'report' | 'natural' | 'realtime' | 'export' | 'mobile';
  validation: ValidationCriteria;
}

export interface ValidationCriteria {
  contentMustInclude: string[];
  contentMustNotInclude?: string[];
  responseTimeMax: number;
  visualElements: string[];
  businessMetrics: string[];
  executiveLanguage: boolean;
}

export interface TestResult {
  queryId: string;
  success: boolean;
  responseTime: number;
  modelUsed: string;
  screenshotPaths: string[];
  validationResults: ValidationResult[];
  errorMessages?: string[];
  performanceMetrics: PerformanceMetrics;
}

export interface ValidationResult {
  criteria: string;
  passed: boolean;
  actualValue?: any;
  expectedValue?: any;
  message: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  networkCalls: number;
  tokenCount?: number;
}

export interface WebSocketMessage {
  type: 'user_message' | 'assistant_response' | 'system_status' | 'error';
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    tokenCount?: number;
    responseTime?: number;
  };
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
}

export interface ScreenshotCapture {
  name: string;
  path: string;
  timestamp: number;
  viewport: { width: number; height: number };
  description: string;
}

export interface CEODashboardElements {
  kpiCards: string[];
  chartContainers: string[];
  navigationElements: string[];
  chatInterface: string[];
  loadingIndicators: string[];
  errorMessages: string[];
}

export interface AzureServiceResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
  responseTime: number;
}

export interface TestConfiguration {
  baseUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  screenshots: boolean;
  videos: boolean;
  trace: boolean;
  reporters: string[];
}

export interface ExecutiveReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    averageResponseTime: number;
  };
  queryResults: TestResult[];
  performanceAnalysis: {
    fastestQuery: TestResult;
    slowestQuery: TestResult;
    modelUsageStats: Record<string, number>;
  };
  recommendations: string[];
  readinessAssessment: 'ready' | 'needs_attention' | 'not_ready';
  visualEvidence: string[]; // Screenshot paths
}