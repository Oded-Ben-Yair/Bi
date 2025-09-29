/**
 * Performance Monitor for Seekapa BI Agent Testing
 * Tracks response times, model usage, and CEO-focused metrics
 */

import { Page } from '@playwright/test';
import { PerformanceMetrics } from '../types';

export class PerformanceMonitor {
  private page: Page;
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private startTimes: Map<string, number> = new Map();
  private networkCalls: Array<{ url: string; method: string; duration: number }> = [];

  constructor(page: Page) {
    this.page = page;
    this.setupNetworkMonitoring();
  }

  /**
   * Setup network monitoring to track API calls
   */
  private setupNetworkMonitoring(): void {
    this.page.on('request', request => {
      const startTime = Date.now();
      this.startTimes.set(request.url(), startTime);
    });

    this.page.on('response', response => {
      const endTime = Date.now();
      const url = response.url();
      const startTime = this.startTimes.get(url);

      if (startTime) {
        const duration = endTime - startTime;
        this.networkCalls.push({
          url,
          method: response.request().method(),
          duration
        });
        this.startTimes.delete(url);
      }
    });
  }

  /**
   * Start performance monitoring for a specific query
   */
  startMonitoring(queryId: string): void {
    const startTime = performance.now();
    this.startTimes.set(queryId, startTime);
    console.log(`📊 Performance monitoring started for: ${queryId}`);
  }

  /**
   * Stop monitoring and record metrics
   */
  async stopMonitoring(queryId: string): Promise<PerformanceMetrics> {
    const endTime = performance.now();
    const startTime = this.startTimes.get(queryId);

    if (!startTime) {
      throw new Error(`No start time found for query: ${queryId}`);
    }

    // Calculate total response time
    const responseTime = endTime - startTime;

    // Get page performance metrics
    const pageMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');

      return {
        loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
        firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    // Get memory usage if available
    const memoryUsage = await this.page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSMemory: (performance as any).memory.usedJSHeapSize,
        totalJSMemory: (performance as any).memory.totalJSHeapSize,
        limitJSMemory: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    // Count relevant network calls for this query
    const relevantCalls = this.networkCalls.filter(call =>
      call.url.includes('/api/') || call.url.includes('/ws/')
    );

    const metrics: PerformanceMetrics = {
      responseTime: Math.round(responseTime),
      loadTime: Math.round(pageMetrics.loadTime),
      renderTime: Math.round(pageMetrics.firstContentfulPaint),
      memoryUsage: memoryUsage?.usedJSMemory,
      networkCalls: relevantCalls.length,
      // These will be populated by WebSocket manager
      tokenCount: undefined
    };

    this.metrics.set(queryId, metrics);
    this.startTimes.delete(queryId);

    console.log(`📊 Performance monitoring completed for: ${queryId}`, metrics);
    return metrics;
  }

  /**
   * Measure specific UI interactions
   */
  async measureInteraction(name: string, interaction: () => Promise<void>): Promise<number> {
    const startTime = performance.now();
    await interaction();
    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`⏱️  ${name}: ${Math.round(duration)}ms`);
    return duration;
  }

  /**
   * Measure WebSocket message round trip
   */
  async measureWebSocketRoundTrip(
    sendMessage: () => Promise<void>,
    waitForResponse: () => Promise<any>
  ): Promise<number> {
    const startTime = performance.now();
    await sendMessage();
    await waitForResponse();
    const endTime = performance.now();

    return endTime - startTime;
  }

  /**
   * Measure page load performance
   */
  async measurePageLoad(url: string): Promise<{
    navigationTime: number;
    domContentLoaded: number;
    loadComplete: number;
    firstPaint: number;
  }> {
    const startTime = performance.now();

    await this.page.goto(url, { waitUntil: 'load' });

    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');

      return {
        navigationTime: navigation.responseEnd - navigation.requestStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
        loadComplete: navigation.loadEventEnd - navigation.navigationStart,
        firstPaint: paintEntries.find(entry => entry.name === 'first-paint')?.startTime || 0
      };
    });

    return metrics;
  }

  /**
   * Check if response time meets CEO requirements
   */
  validateCEOResponseTime(responseTime: number): {
    passed: boolean;
    grade: 'excellent' | 'good' | 'acceptable' | 'poor';
    message: string;
  } {
    const ceoThreshold = 3000; // 3 seconds for CEO use
    const excellentThreshold = 1000; // 1 second
    const goodThreshold = 2000; // 2 seconds

    if (responseTime <= excellentThreshold) {
      return {
        passed: true,
        grade: 'excellent',
        message: `⚡ Excellent response time: ${responseTime}ms (CEO requirement: <3s)`
      };
    } else if (responseTime <= goodThreshold) {
      return {
        passed: true,
        grade: 'good',
        message: `✅ Good response time: ${responseTime}ms (CEO requirement: <3s)`
      };
    } else if (responseTime <= ceoThreshold) {
      return {
        passed: true,
        grade: 'acceptable',
        message: `⚠️  Acceptable response time: ${responseTime}ms (CEO requirement: <3s)`
      };
    } else {
      return {
        passed: false,
        grade: 'poor',
        message: `❌ Poor response time: ${responseTime}ms (exceeds CEO requirement: <3s)`
      };
    }
  }

  /**
   * Get all recorded metrics
   */
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalQueries: number;
    averageResponseTime: number;
    fastestQuery: { id: string; time: number } | null;
    slowestQuery: { id: string; time: number } | null;
    ceoCompliantQueries: number;
    performanceGrade: string;
  } {
    const entries = Array.from(this.metrics.entries());

    if (entries.length === 0) {
      return {
        totalQueries: 0,
        averageResponseTime: 0,
        fastestQuery: null,
        slowestQuery: null,
        ceoCompliantQueries: 0,
        performanceGrade: 'N/A'
      };
    }

    const responseTimes = entries.map(([id, metrics]) => ({
      id,
      time: metrics.responseTime
    }));

    const averageResponseTime = responseTimes.reduce((sum, { time }) => sum + time, 0) / responseTimes.length;
    const ceoCompliantQueries = responseTimes.filter(({ time }) => time <= 3000).length;
    const fastestQuery = responseTimes.reduce((min, current) => min.time < current.time ? min : current);
    const slowestQuery = responseTimes.reduce((max, current) => max.time > current.time ? max : current);

    // Calculate performance grade
    const complianceRate = ceoCompliantQueries / entries.length;
    let performanceGrade: string;

    if (complianceRate === 1 && averageResponseTime <= 2000) {
      performanceGrade = 'A+ (Excellent for CEO use)';
    } else if (complianceRate === 1) {
      performanceGrade = 'A (Very good for CEO use)';
    } else if (complianceRate >= 0.8) {
      performanceGrade = 'B (Good for CEO use)';
    } else if (complianceRate >= 0.6) {
      performanceGrade = 'C (Needs improvement)';
    } else {
      performanceGrade = 'D (Not suitable for CEO use)';
    }

    return {
      totalQueries: entries.length,
      averageResponseTime: Math.round(averageResponseTime),
      fastestQuery,
      slowestQuery,
      ceoCompliantQueries,
      performanceGrade
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const summary = this.getPerformanceSummary();
    const entries = Array.from(this.metrics.entries());

    const report = `
# Performance Report - Seekapa BI Agent
Generated: ${new Date().toISOString()}

## Executive Summary
- **Total Queries Tested**: ${summary.totalQueries}
- **Average Response Time**: ${summary.averageResponseTime}ms
- **CEO Compliant Queries**: ${summary.ceoCompliantQueries}/${summary.totalQueries} (${Math.round((summary.ceoCompliantQueries / summary.totalQueries) * 100)}%)
- **Performance Grade**: ${summary.performanceGrade}
- **Fastest Query**: ${summary.fastestQuery?.id} (${summary.fastestQuery?.time}ms)
- **Slowest Query**: ${summary.slowestQuery?.id} (${summary.slowestQuery?.time}ms)

## CEO Requirements Analysis
✅ **Target**: All queries < 3 seconds
${summary.ceoCompliantQueries === summary.totalQueries ? '✅' : '❌'} **Status**: ${summary.ceoCompliantQueries}/${summary.totalQueries} queries meet requirement

## Detailed Query Performance
${entries.map(([id, metrics]) => {
  const validation = this.validateCEOResponseTime(metrics.responseTime);
  return `
### ${id}
- **Response Time**: ${metrics.responseTime}ms ${validation.grade === 'excellent' ? '⚡' : validation.grade === 'good' ? '✅' : validation.grade === 'acceptable' ? '⚠️' : '❌'}
- **Load Time**: ${metrics.loadTime}ms
- **Render Time**: ${metrics.renderTime}ms
- **Network Calls**: ${metrics.networkCalls}
- **Memory Usage**: ${metrics.memoryUsage ? Math.round(metrics.memoryUsage / 1024 / 1024) + 'MB' : 'N/A'}
- **Grade**: ${validation.grade}
`;
}).join('')}

## Network Performance
${this.networkCalls.map(call => `
- **${call.method}** ${call.url}: ${call.duration}ms
`).join('')}

## Recommendations
${summary.performanceGrade.startsWith('A') ? '🎉 Performance is excellent for CEO use.' : summary.performanceGrade.startsWith('B') ? '👍 Performance is good. Consider minor optimizations.' : '⚠️ Performance needs improvement for CEO deployment.'}
    `;

    return report.trim();
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.startTimes.clear();
    this.networkCalls = [];
  }
}