/**
 * CEO Deployment Validation Tests
 * Comprehensive testing of 10 business-focused queries using Edge browser
 */

import { test, expect, Page } from '@playwright/test';
import { WebSocketManager } from './utils/websocket-manager';
import { ScreenshotManager } from './utils/screenshot-manager';
import { HealthChecker } from './utils/health-checker';
import { PerformanceMonitor } from './utils/performance-monitor';
import { CEO_QUERIES, validateQueryResponse } from './fixtures/ceo-queries';
import { TestResult, ExecutiveReport } from './types';

// Global test state
let testResults: TestResult[] = [];
let overallStartTime: number;

test.describe('Seekapa BI Agent - CEO Deployment Validation', () => {
  let wsManager: WebSocketManager;
  let screenshotManager: ScreenshotManager;
  let healthChecker: HealthChecker;
  let performanceMonitor: PerformanceMonitor;

  test.beforeAll(async () => {
    console.log('🚀 Starting CEO Deployment Validation Suite');
    console.log('📊 Testing 10 business-focused queries with Edge browser');
    overallStartTime = Date.now();
  });

  test.beforeEach(async ({ page }) => {
    // Initialize managers
    wsManager = new WebSocketManager(page);
    screenshotManager = new ScreenshotManager(page, 'ceo-deployment-validation');
    healthChecker = new HealthChecker(page);
    performanceMonitor = new PerformanceMonitor(page);

    // Comprehensive health check
    console.log('🏥 Performing health check...');
    const healthResult = await healthChecker.checkAllServices();

    if (!healthResult.allHealthy) {
      console.error('❌ Health check failed:', healthResult.summary);
      console.log('📋 Health details:', healthResult.results);

      // Take screenshot of health issues
      await screenshotManager.capture(
        'health_check_failed',
        'Health check failed - system not ready',
        { fullPage: true }
      );

      throw new Error(`Health check failed: ${healthResult.summary}`);
    }

    console.log('✅ Health check passed:', healthResult.summary);

    // Establish WebSocket connection
    console.log('🔌 Establishing WebSocket connection...');
    await wsManager.connect();

    if (!wsManager.isConnected()) {
      console.warn('⚠️  WebSocket connection not detected, proceeding with UI testing');
    }

    // Capture initial state
    await screenshotManager.capture(
      'initial_dashboard',
      'Clean dashboard state ready for testing',
      { fullPage: true }
    );
  });

  // Test each CEO query individually for detailed reporting
  CEO_QUERIES.forEach((query, index) => {
    test(`Query ${index + 1}: ${query.description}`, async ({ page }) => {
      console.log(`\n📝 Testing Query ${index + 1}/${CEO_QUERIES.length}: ${query.description}`);
      console.log(`💬 Query: "${query.query}"`);
      console.log(`🤖 Expected Model: ${query.expectedModel}`);
      console.log(`⏱️  Expected Response Time: ${query.expectedResponseTime}ms`);

      // Start performance monitoring
      performanceMonitor.startMonitoring(query.id);

      const testResult: TestResult = {
        queryId: query.id,
        success: false,
        responseTime: 0,
        modelUsed: 'unknown',
        screenshotPaths: [],
        validationResults: [],
        errorMessages: [],
        performanceMetrics: {
          responseTime: 0,
          loadTime: 0,
          renderTime: 0,
          networkCalls: 0
        }
      };

      try {
        // Capture test sequence screenshots
        const screenshots = await screenshotManager.captureTestSequence(query.description);
        testResult.screenshotPaths.push(screenshots.initial);

        // Step 1: Input the query
        console.log('📝 Step 1: Inputting query...');

        // Wait for chat interface
        await page.waitForSelector('textarea[placeholder*="DS-Axia"]', {
          timeout: 10000
        });

        // Find and interact with chat input
        const chatInput = page.locator('textarea[placeholder*="DS-Axia"]').first();

        await chatInput.click(); // Click to focus
        await chatInput.fill(query.query);

        // Wait for send button to be enabled
        await page.waitForSelector('button[aria-label="Send message"]:not([disabled])', {
          timeout: 5000
        });

        // Capture input state
        const inputScreenshot = await screenshotManager.captureInput(query.query);
        testResult.screenshotPaths.push(inputScreenshot);

        // Step 2: Send the query
        console.log('📤 Step 2: Sending query...');
        const queryStartTime = Date.now();

        // Find and click send button
        const sendButton = page.locator('button[aria-label="Send message"]').first();

        await sendButton.click();

        // Capture processing state
        await page.waitForTimeout(500); // Brief pause to catch loading state
        const processingScreenshot = await screenshotManager.captureProcessing();
        testResult.screenshotPaths.push(processingScreenshot);

        // Step 3: Wait for response
        console.log('⏳ Step 3: Waiting for AI response...');

        let response = null;
        console.log(`🔌 WebSocket connected: ${wsManager.isConnected()}`);

        // Always use DOM-based detection for now since WebSocket logic is complex
        try {
          console.log('🔍 Waiting for bot response icon...');
          await page.waitForSelector('.lucide-bot', {
            timeout: query.validation.responseTimeMax
          });

          console.log('🤖 Bot icon found, extracting response...');

          // Get the assistant message content (look for the container with bot icon)
          const assistantMessageContainer = page.locator('div.space-y-6 > div').filter({
            has: page.locator('.lucide-bot')
          }).first();

          const responseText = await assistantMessageContainer.locator('div.markdown-content, p').textContent();
          console.log(`📝 Response extracted: ${responseText?.substring(0, 100)}...`);

          response = {
            content: responseText || '',
            timestamp: Date.now(),
            type: 'assistant_response' as const,
            metadata: {
              responseTime: Date.now() - queryStartTime
            }
          };
        } catch (domError) {
          console.log(`❌ DOM-based detection failed: ${domError}`);

          // Fallback: try WebSocket if available
          if (wsManager.isConnected()) {
            console.log('🔄 Trying WebSocket fallback...');
            try {
              response = await wsManager.waitForResponse(5000); // Shorter timeout for fallback
            } catch (wsError) {
              console.log(`❌ WebSocket fallback failed: ${wsError}`);
            }
          }
        }

        const actualResponseTime = Date.now() - queryStartTime;
        testResult.responseTime = actualResponseTime;

        if (!response || !response.content) {
          throw new Error('No response received from AI assistant');
        }

        console.log(`✅ Response received in ${actualResponseTime}ms`);
        console.log(`🤖 Model used: ${response.metadata?.model || 'not specified'}`);

        testResult.modelUsed = response.metadata?.model || 'unknown';

        // Capture final result
        await page.waitForTimeout(2000); // Allow time for full rendering
        const resultScreenshot = await screenshotManager.captureResult();
        testResult.screenshotPaths.push(resultScreenshot);

        // Step 4: Validate response
        console.log('✅ Step 4: Validating response quality...');

        const validation = validateQueryResponse(
          query,
          response.content,
          actualResponseTime,
          testResult.modelUsed
        );

        testResult.validationResults = Object.entries(validation.details).map(([criteria, passed]) => ({
          criteria,
          passed,
          actualValue: passed ? '✅' : '❌',
          expectedValue: '✅',
          message: passed ? `${criteria} validation passed` : `${criteria} validation failed`
        }));

        // Performance validation
        const performanceValidation = performanceMonitor.validateCEOResponseTime(actualResponseTime);
        testResult.validationResults.push({
          criteria: 'ceo_response_time',
          passed: performanceValidation.passed,
          actualValue: actualResponseTime,
          expectedValue: query.validation.responseTimeMax,
          message: performanceValidation.message
        });

        // Stop performance monitoring
        testResult.performanceMetrics = await performanceMonitor.stopMonitoring(query.id);

        // Mark as successful if validation passed
        testResult.success = validation.passed && performanceValidation.passed;

        // Log validation results
        console.log(`📊 Validation Score: ${validation.score}%`);
        console.log(`⚡ Performance Grade: ${performanceValidation.grade}`);

        if (validation.issues.length > 0) {
          console.log('⚠️  Issues found:');
          validation.issues.forEach(issue => console.log(`   - ${issue}`));
          testResult.errorMessages = validation.issues;
        }

        // Playwright assertions for test reporting
        expect(response.content).toBeTruthy();
        expect(actualResponseTime).toBeLessThanOrEqual(query.validation.responseTimeMax);
        expect(validation.score).toBeGreaterThanOrEqual(70); // 70% minimum quality score

        // Content validation assertions
        query.validation.contentMustInclude.forEach(term => {
          expect(response.content.toLowerCase()).toContain(term.toLowerCase());
        });

        if (query.validation.contentMustNotInclude) {
          query.validation.contentMustNotInclude.forEach(term => {
            expect(response.content.toLowerCase()).not.toContain(term.toLowerCase());
          });
        }

        console.log(`✅ Query ${index + 1} completed successfully`);

      } catch (error) {
        console.error(`❌ Query ${index + 1} failed:`, error);

        testResult.success = false;
        testResult.errorMessages = [String(error)];

        // Capture error state
        try {
          const errorScreenshot = await screenshotManager.captureError(String(error));
          testResult.screenshotPaths.push(errorScreenshot);
        } catch (screenshotError) {
          console.warn('Failed to capture error screenshot:', screenshotError);
        }

        // Stop monitoring even on error
        try {
          testResult.performanceMetrics = await performanceMonitor.stopMonitoring(query.id);
        } catch (monitorError) {
          console.warn('Failed to stop performance monitoring:', monitorError);
        }

        throw error; // Re-throw to mark test as failed
      } finally {
        // Store test result
        testResults.push(testResult);

        // Clear WebSocket messages for next test
        wsManager.clearMessages();

        console.log(`📸 Screenshots captured: ${testResult.screenshotPaths.length}`);
      }
    });
  });

  test.afterAll(async () => {
    const totalTime = Date.now() - overallStartTime;

    console.log('\n📊 Generating comprehensive test report...');

    // Generate executive report
    const executiveReport = generateExecutiveReport(testResults, totalTime);

    // Generate HTML reports
    const performanceReport = performanceMonitor.generatePerformanceReport();
    const screenshotReport = screenshotManager.generateHTMLReport();

    console.log('\n' + '='.repeat(60));
    console.log('🎯 CEO DEPLOYMENT VALIDATION COMPLETE');
    console.log('='.repeat(60));
    console.log(executiveReport.summary);
    console.log('\n📈 Performance Analysis:');
    console.log(executiveReport.performanceAnalysis);
    console.log('\n💡 Recommendations:');
    executiveReport.recommendations.forEach(rec => console.log(`   • ${rec}`));
    console.log('\n🚀 Deployment Readiness:', executiveReport.readinessAssessment.toUpperCase());
    console.log('='.repeat(60));

    // Export results for CI/reporting systems
    console.log(`\n📁 Test artifacts generated:`);
    console.log(`   • Screenshots: ${screenshotManager.getScreenshotPaths().length} files`);
    console.log(`   • Performance report: Available`);
    console.log(`   • Executive summary: Available`);
  });
});

/**
 * Generate executive-level test report
 */
function generateExecutiveReport(results: TestResult[], totalTime: number): ExecutiveReport {
  const totalTests = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = totalTests - passed;
  const successRate = Math.round((passed / totalTests) * 100);

  const responseTimes = results.map(r => r.responseTime).filter(rt => rt > 0);
  const averageResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const fastestQuery = results.length > 0
    ? results.reduce((fastest, current) => current.responseTime < fastest.responseTime ? current : fastest)
    : { queryId: 'none', responseTime: 0 };

  const slowestQuery = results.length > 0
    ? results.reduce((slowest, current) => current.responseTime > slowest.responseTime ? current : slowest)
    : { queryId: 'none', responseTime: 0 };

  const modelUsageStats = results.reduce((stats, result) => {
    stats[result.modelUsed] = (stats[result.modelUsed] || 0) + 1;
    return stats;
  }, {} as Record<string, number>);

  const recommendations = [];
  if (successRate < 100) {
    recommendations.push(`${failed} queries failed - review error logs and retry`);
  }
  if (averageResponseTime > 2000) {
    recommendations.push('Average response time exceeds 2s - consider performance optimization');
  }
  if (successRate >= 90) {
    recommendations.push('Excellent test results - ready for CEO deployment');
  }

  let readinessAssessment: 'ready' | 'needs_attention' | 'not_ready';
  if (successRate === 100 && averageResponseTime <= 3000) {
    readinessAssessment = 'ready';
  } else if (successRate >= 80) {
    readinessAssessment = 'needs_attention';
  } else {
    readinessAssessment = 'not_ready';
  }

  return {
    summary: {
      totalTests,
      passed,
      failed,
      successRate,
      averageResponseTime
    },
    queryResults: results,
    performanceAnalysis: {
      fastestQuery,
      slowestQuery,
      modelUsageStats
    },
    recommendations,
    readinessAssessment,
    visualEvidence: results.flatMap(r => r.screenshotPaths)
  };
}