export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
  error?: boolean;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

export interface DatasetInfo {
  id: string;
  name: string;
  description?: string;
  tables?: TableInfo[];
  lastRefresh?: string;
  size?: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable?: boolean;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  columns?: string[];
  rowCount?: number;
  error?: string;
}

export interface AnalysisResult {
  analysis: string;
  charts?: ChartConfig[];
  insights?: Insight[];
  recommendations?: string[];
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  data: any;
  title?: string;
  description?: string;
}

export interface Insight {
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  metric?: string;
  value?: number | string;
}

export interface ModelInfo {
  name: string;
  description: string;
  maxTokens: number;
  costTier: 'low' | 'medium' | 'high';
  responseTime: string;
  useCase: string;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}