/**
 * Performance Tests for Seekapa BI Agent
 * CEO-focused performance testing with sub-3-second load requirements
 */

import { test, expect, Page } from '@playwright/test';

// Performance thresholds for CEO requirements
const PERFORMANCE_THRESHOLDS = {
  pageLoad: 3000,        // 3 seconds max page load
  chatResponse: 10000,   // 10 seconds max for AI response
  dataRefresh: 15000,    // 15 seconds max for data refresh
  kpiCardLoad: 2000,     // 2 seconds max for KPI cards
  firstContentfulPaint: 1500, // 1.5 seconds max FCP
  largestContentfulPaint: 2500, // 2.5 seconds max LCP
  cumulativeLayoutShift: 0.1,   // 0.1 max CLS
  firstInputDelay: 100          // 100ms max FID
};

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cache and prepare for clean performance measurement
    await page.evaluate(() => {
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
    });
  });

  test('CEO Dashboard - Page Load Performance', async ({ page }) => {
    const startTime = Date.now();

    // Navigate with performance tracking
    await page.goto('/', { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;

    // Verify page load meets CEO requirement
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);

    // Get detailed performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnect: navigation.connectEnd - navigation.connectStart,
        serverResponse: navigation.responseEnd - navigation.requestStart,
        domProcessing: navigation.domComplete - navigation.domLoading,
        firstPaint: 0,
        firstContentfulPaint: 0
      };
    });

    // Log performance metrics for analysis
    console.log('CEO Dashboard Performance Metrics:', {
      totalLoadTime: loadTime,
      ...performanceMetrics
    });

    // Verify critical sub-metrics
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
    expect(performanceMetrics.serverResponse).toBeLessThan(1000);
  });

  test('KPI Cards - Loading Performance', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');

    // Wait for KPI cards to be visible
    await expect(page.locator('[data-testid="kpi-card"]').first()).toBeVisible();

    const kpiLoadTime = Date.now() - startTime;

    // Verify KPI cards load within threshold
    expect(kpiLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.kpiCardLoad);

    // Verify all 4 KPI cards are loaded
    await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(4, { timeout: 5000 });

    // Check that KPI cards have data (not loading state)
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    for (let i = 0; i < await kpiCards.count(); i++) {
      const card = kpiCards.nth(i);
      const kpiValue = card.locator('[data-testid="kpi-value"]');
      await expect(kpiValue).not.toBeEmpty();
      await expect(kpiValue).not.toContainText('Loading...');
    }

    console.log('KPI Cards Load Time:', kpiLoadTime);
  });

  test('Chat Response - Performance Under Load', async ({ page }) => {
    await page.goto('/');

    const testQueries = [
      'What are our top revenue streams?',
      'Show me quarterly sales breakdown',
      'Analyze customer segmentation data',
      'Generate executive summary report'
    ];

    const responseTimes: number[] = [];

    for (const query of testQueries) {
      const startTime = Date.now();

      // Send query
      await page.locator('[data-testid="chat-input"]').fill(query);
      await page.locator('[data-testid="send-button"]').click();

      // Wait for AI response
      await expect(page.locator('[data-testid="message"][data-role="assistant"]').last())
        .toBeVisible({ timeout: PERFORMANCE_THRESHOLDS.chatResponse });

      const responseTime = Date.now() - startTime;
      responseTimes.push(responseTime);

      // Verify response time meets threshold
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.chatResponse);

      // Clear input for next query
      await page.locator('[data-testid="chat-input"]').clear();
    }

    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    console.log('Chat Response Performance:', {
      responseTimes,
      averageResponseTime,
      maxResponseTime: Math.max(...responseTimes),
      minResponseTime: Math.min(...responseTimes)
    });
  });

  test('Data Refresh - Performance Monitoring', async ({ page }) => {
    await page.goto('/');

    // Wait for initial load
    await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(4);

    const startTime = Date.now();

    // Trigger data refresh
    const refreshButton = page.locator('[data-testid="refresh-data"]');
    await refreshButton.click();

    // Wait for loading indicator
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

    // Wait for refresh to complete
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({
      timeout: PERFORMANCE_THRESHOLDS.dataRefresh
    });

    const refreshTime = Date.now() - startTime;

    // Verify refresh time meets threshold
    expect(refreshTime).toBeLessThan(PERFORMANCE_THRESHOLDS.dataRefresh);

    // Verify data is actually updated
    const lastUpdated = await page.locator('[data-testid="last-updated"]').textContent();
    expect(lastUpdated).toBeTruthy();

    console.log('Data Refresh Time:', refreshTime);
  });

  test('Concurrent User Simulation', async ({ browser }) => {
    const numUsers = 5;
    const contexts = [];
    const pages = [];

    // Create multiple browser contexts (simulating different users)
    for (let i = 0; i < numUsers; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }

    const loadTimes: number[] = [];

    // Simulate concurrent dashboard access
    const loadPromises = pages.map(async (page, index) => {
      const startTime = Date.now();

      await page.goto('/');
      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

      const loadTime = Date.now() - startTime;
      loadTimes.push(loadTime);

      // Each user sends a chat message
      await page.locator('[data-testid="chat-input"]').fill(`User ${index + 1} query`);
      await page.locator('[data-testid="send-button"]').click();

      return loadTime;
    });

    await Promise.all(loadPromises);

    // Analyze concurrent performance
    const averageLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    const maxLoadTime = Math.max(...loadTimes);

    console.log('Concurrent User Performance:', {
      numUsers,
      loadTimes,
      averageLoadTime,
      maxLoadTime
    });

    // Under concurrent load, performance should still be acceptable
    expect(maxLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad * 1.5); // Allow 50% degradation
    expect(averageLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);

    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  });

  test('Memory Usage Monitoring', async ({ page }) => {
    await page.goto('/');

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    // Simulate heavy usage
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-testid="chat-input"]').fill(`Memory test query ${i}`);
      await page.locator('[data-testid="send-button"]').click();
      await page.waitForTimeout(500);
    }

    // Trigger data refresh multiple times
    for (let i = 0; i < 3; i++) {
      const refreshButton = page.locator('[data-testid="refresh-data"]');
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      } : null;
    });

    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;

      console.log('Memory Usage Analysis:', {
        initialMemory: Math.round(initialMemory.usedJSHeapSize / 1024 / 1024),
        finalMemory: Math.round(finalMemory.usedJSHeapSize / 1024 / 1024),
        memoryIncreaseMB: Math.round(memoryIncrease / 1024 / 1024),
        memoryIncreasePercent: Math.round(memoryIncreasePercent)
      });

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);
    }
  });

  test('Network Performance Analysis', async ({ page }) => {
    const networkMetrics: any[] = [];

    // Monitor network requests
    page.on('response', response => {
      networkMetrics.push({
        url: response.url(),
        status: response.status(),
        size: response.headers()['content-length'] || 0,
        timing: response.timing()
      });
    });

    await page.goto('/');
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

    // Send a chat message to trigger API calls
    await page.locator('[data-testid="chat-input"]').fill('Network performance test');
    await page.locator('[data-testid="send-button"]').click();
    await page.waitForTimeout(3000);

    // Analyze network performance
    const apiRequests = networkMetrics.filter(m => m.url.includes('/api/'));
    const staticAssets = networkMetrics.filter(m =>
      m.url.includes('.js') || m.url.includes('.css') || m.url.includes('.png')
    );

    console.log('Network Performance Analysis:', {
      totalRequests: networkMetrics.length,
      apiRequests: apiRequests.length,
      staticAssets: staticAssets.length,
      slowRequests: networkMetrics.filter(m => m.timing && m.timing.responseEnd > 1000).length
    });

    // Verify no excessively slow requests
    const slowRequests = networkMetrics.filter(m =>
      m.timing && (m.timing.responseEnd - m.timing.requestStart) > 5000
    );
    expect(slowRequests.length).toBe(0);
  });

  test('Mobile Performance - CEO Mobile Access', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    const startTime = Date.now();

    await page.goto('/');
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

    const mobileLoadTime = Date.now() - startTime;

    // Mobile load time should still meet CEO requirements
    expect(mobileLoadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.pageLoad);

    // Test mobile chat performance
    const chatStartTime = Date.now();

    await page.locator('[data-testid="chat-input"]').fill('Mobile performance test');
    await page.locator('[data-testid="send-button"]').click();

    await expect(page.locator('[data-testid="message"][data-role="assistant"]').last())
      .toBeVisible({ timeout: PERFORMANCE_THRESHOLDS.chatResponse });

    const mobileChatTime = Date.now() - chatStartTime;

    console.log('Mobile Performance:', {
      mobileLoadTime,
      mobileChatTime
    });

    // Mobile performance should be within acceptable range
    expect(mobileChatTime).toBeLessThan(PERFORMANCE_THRESHOLDS.chatResponse * 1.2); // 20% tolerance for mobile
  });

  test('Core Web Vitals Monitoring', async ({ page }) => {
    await page.goto('/');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Measure Core Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {};

        // First Contentful Paint
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime;
            }
          }
        }).observe({ entryTypes: ['paint'] });

        // Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.startTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          vitals.cls = clsValue;
        }).observe({ entryTypes: ['layout-shift'] });

        // First Input Delay would need user interaction simulation
        setTimeout(() => resolve(vitals), 3000);
      });
    });

    console.log('Core Web Vitals:', webVitals);

    // Verify Core Web Vitals meet thresholds
    if ((webVitals as any).fcp) {
      expect((webVitals as any).fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint);
    }
    if ((webVitals as any).lcp) {
      expect((webVitals as any).lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint);
    }
    if ((webVitals as any).cls !== undefined) {
      expect((webVitals as any).cls).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift);
    }
  });

  test('Performance Regression Detection', async ({ page }) => {
    // This test would compare against baseline performance metrics
    // In a real implementation, you'd store baseline metrics and compare

    const performanceBaseline = {
      pageLoad: 2500,
      chatResponse: 8000,
      kpiLoad: 1500
    };

    // Measure current performance
    const startTime = Date.now();
    await page.goto('/');
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    const currentPageLoad = Date.now() - startTime;

    // Check for regression (performance should not be significantly worse)
    const regressionThreshold = 1.3; // 30% degradation threshold
    expect(currentPageLoad).toBeLessThan(performanceBaseline.pageLoad * regressionThreshold);

    console.log('Performance Regression Check:', {
      baseline: performanceBaseline.pageLoad,
      current: currentPageLoad,
      regression: currentPageLoad / performanceBaseline.pageLoad,
      passed: currentPageLoad < performanceBaseline.pageLoad * regressionThreshold
    });
  });
});