/**
 * E2E Tests for CEO Critical User Flows
 * Tests the complete user journey for executive dashboard access and chat functionality
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { ScreenshotManager } from '../utils/screenshot-manager';
import { HealthChecker } from '../utils/health-checker';
import { WebSocketManager } from '../utils/websocket-manager';

test.describe('CEO Critical User Flows', () => {
  let performanceMonitor: PerformanceMonitor;
  let screenshotManager: ScreenshotManager;
  let healthChecker: HealthChecker;
  let wsManager: WebSocketManager;

  test.beforeEach(async ({ page, context }) => {
    performanceMonitor = new PerformanceMonitor(page);
    screenshotManager = new ScreenshotManager(page);
    healthChecker = new HealthChecker();
    wsManager = new WebSocketManager(page);

    // Enable performance monitoring
    await performanceMonitor.startMonitoring();

    // Verify all services are healthy before testing
    await healthChecker.checkAllServices();

    // Navigate to the application
    await page.goto('/');

    // Wait for the page to be fully loaded
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Take screenshot if test failed
    if (test.info().status !== test.info().expectedStatus) {
      await screenshotManager.captureFailure(test.info().title);
    }

    // Stop performance monitoring and collect metrics
    const metrics = await performanceMonitor.stopMonitoring();
    console.log('Performance metrics:', metrics);

    // Cleanup WebSocket connections
    await wsManager.cleanup();
  });

  test('CEO Dashboard - Complete Loading Flow', async ({ page }) => {
    // Test Step 1: Application loads within performance budget
    const loadStartTime = Date.now();

    // Verify main dashboard elements are present
    await expect(page.locator('[data-testid="ceo-dashboard"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    const loadTime = Date.now() - loadStartTime;
    expect(loadTime).toBeLessThan(3000); // Sub-3-second requirement

    // Test Step 2: Executive KPI cards load
    await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(4, { timeout: 5000 });

    // Verify KPI cards have data
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    for (let i = 0; i < await kpiCards.count(); i++) {
      const card = kpiCards.nth(i);
      await expect(card.locator('[data-testid="kpi-value"]')).not.toBeEmpty();
      await expect(card.locator('[data-testid="kpi-trend"]')).toBeVisible();
    }

    // Test Step 3: Professional theme is applied
    const bodyElement = page.locator('body');
    const backgroundColor = await bodyElement.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    // Verify amber theme colors
    expect(backgroundColor).toMatch(/(rgba?\(245,\s*245,\s*220|rgb\(245,\s*245,\s*220|\#f5f5dc)/);

    // Take screenshot for visual verification
    await screenshotManager.captureSuccess('ceo-dashboard-loaded');
  });

  test('Chat Interface - Complete Interaction Flow', async ({ page }) => {
    // Test Step 1: WebSocket connection establishment
    await wsManager.waitForConnection();
    const connectionStatus = await wsManager.getConnectionStatus();
    expect(connectionStatus).toBe('connected');

    // Test Step 2: Send CEO-level query
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    const ceoQuery = "What are our top 5 revenue streams this quarter and how do they compare to last quarter?";
    await chatInput.fill(ceoQuery);

    // Verify send button is enabled
    await expect(sendButton).toBeEnabled();

    // Send the message
    await sendButton.click();

    // Test Step 3: Message appears in chat
    const userMessage = page.locator('[data-testid="message"]').filter({ hasText: ceoQuery });
    await expect(userMessage).toBeVisible({ timeout: 2000 });

    // Test Step 4: Typing indicator appears
    const typingIndicator = page.locator('[data-testid="typing-indicator"]');
    await expect(typingIndicator).toBeVisible({ timeout: 3000 });

    // Test Step 5: AI response is received
    const aiResponse = page.locator('[data-testid="message"][data-role="assistant"]').last();
    await expect(aiResponse).toBeVisible({ timeout: 30000 }); // CEO queries can take longer

    // Verify response contains relevant data
    const responseText = await aiResponse.textContent();
    expect(responseText).toMatch(/(revenue|quarter|sales|financial)/i);

    // Test Step 6: Response formatting is professional
    const formattedElements = aiResponse.locator('.markdown-content');
    if (await formattedElements.count() > 0) {
      await expect(formattedElements.first()).toBeVisible();
    }

    // Verify typing indicator disappears
    await expect(typingIndicator).not.toBeVisible();

    await screenshotManager.captureSuccess('chat-interaction-complete');
  });

  test('WebSocket Resilience - Connection Recovery', async ({ page }) => {
    // Test Step 1: Establish initial connection
    await wsManager.waitForConnection();

    // Test Step 2: Simulate connection drop
    await page.evaluate(() => {
      // Force close WebSocket connection
      if ((window as any).wsConnection) {
        (window as any).wsConnection.close();
      }
    });

    // Test Step 3: Send message during disconnection
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    await chatInput.fill('Test message during disconnection');
    await sendButton.click();

    // Test Step 4: Verify reconnection attempt
    const connectionIndicator = page.locator('[data-testid="connection-status"]');
    await expect(connectionIndicator).toContainText('Reconnecting', { timeout: 5000 });

    // Test Step 5: Verify successful reconnection
    await expect(connectionIndicator).toContainText('Connected', { timeout: 10000 });

    // Test Step 6: Verify message was queued and sent after reconnection
    const queuedMessage = page.locator('[data-testid="message"]').filter({ hasText: 'Test message during disconnection' });
    await expect(queuedMessage).toBeVisible({ timeout: 5000 });
  });

  test('Data Refresh Flow - Real-time Updates', async ({ page }) => {
    // Test Step 1: Initial data load
    await expect(page.locator('[data-testid="kpi-card"]').first()).toBeVisible();
    const initialValue = await page.locator('[data-testid="kpi-value"]').first().textContent();

    // Test Step 2: Trigger data refresh
    const refreshButton = page.locator('[data-testid="refresh-data"]');
    await refreshButton.click();

    // Test Step 3: Verify loading state
    const loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    await expect(loadingIndicator).toBeVisible({ timeout: 2000 });

    // Test Step 4: Verify data update
    await expect(loadingIndicator).not.toBeVisible({ timeout: 10000 });

    // Test Step 5: Verify timestamp update
    const lastUpdated = page.locator('[data-testid="last-updated"]');
    const timestampText = await lastUpdated.textContent();
    const timestamp = new Date(timestampText || '');
    const now = new Date();
    const timeDiff = now.getTime() - timestamp.getTime();
    expect(timeDiff).toBeLessThan(60000); // Updated within last minute

    await screenshotManager.captureSuccess('data-refresh-complete');
  });

  test('Mobile Responsiveness - CEO Mobile Access', async ({ page, context }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12

    // Test Step 1: Mobile navigation
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
    }

    // Test Step 2: Mobile sidebar
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Test Step 3: Mobile KPI cards stack vertically
    const kpiCards = page.locator('[data-testid="kpi-card"]');
    const firstCard = kpiCards.first();
    const secondCard = kpiCards.nth(1);

    const firstCardBox = await firstCard.boundingBox();
    const secondCardBox = await secondCard.boundingBox();

    if (firstCardBox && secondCardBox) {
      // Cards should stack vertically (second card below first)
      expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height);
    }

    // Test Step 4: Mobile chat interface
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    // Verify mobile keyboard doesn't break layout
    await chatInput.click();
    await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();

    await screenshotManager.captureSuccess('mobile-responsive-view');
  });

  test('Error Handling - Graceful Degradation', async ({ page }) => {
    // Test Step 1: Simulate API failure
    await page.route('**/api/chat', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    // Test Step 2: Send chat message
    const chatInput = page.locator('[data-testid="chat-input"]');
    const sendButton = page.locator('[data-testid="send-button"]');

    await chatInput.fill('Test error handling');
    await sendButton.click();

    // Test Step 3: Verify error message display
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    await expect(errorMessage).toContainText('error', { ignoreCase: true });

    // Test Step 4: Verify retry mechanism
    const retryButton = page.locator('[data-testid="retry-button"]');
    if (await retryButton.isVisible()) {
      await retryButton.click();
      // Verify retry attempt was made
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    }

    await screenshotManager.captureSuccess('error-handling-display');
  });

  test('Performance Benchmarks - CEO Requirements', async ({ page }) => {
    // Test Step 1: Page load performance
    const startTime = Date.now();
    await page.goto('/');
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    const pageLoadTime = Date.now() - startTime;

    expect(pageLoadTime).toBeLessThan(3000); // CEO requirement: sub-3-second load

    // Test Step 2: Chat response time
    const chatStartTime = Date.now();
    await page.locator('[data-testid="chat-input"]').fill('Quick test query');
    await page.locator('[data-testid="send-button"]').click();

    await expect(page.locator('[data-testid="message"][data-role="assistant"]').last()).toBeVisible({ timeout: 10000 });
    const chatResponseTime = Date.now() - chatStartTime;

    // CEO queries should respond within 10 seconds for simple queries
    expect(chatResponseTime).toBeLessThan(10000);

    // Test Step 3: Data refresh performance
    const refreshStartTime = Date.now();
    await page.locator('[data-testid="refresh-data"]').click();
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible({ timeout: 15000 });
    const refreshTime = Date.now() - refreshStartTime;

    expect(refreshTime).toBeLessThan(15000); // Data refresh within 15 seconds

    // Log performance metrics
    console.log('CEO Performance Benchmarks:', {
      pageLoadTime,
      chatResponseTime,
      refreshTime,
      allWithinBudget: pageLoadTime < 3000 && chatResponseTime < 10000 && refreshTime < 15000
    });
  });

  test('Accessibility - Executive Standards', async ({ page }) => {
    // Test Step 1: Keyboard navigation
    await page.keyboard.press('Tab');
    let focusedElement = await page.locator(':focus').getAttribute('data-testid');
    expect(focusedElement).toBeTruthy();

    // Test Step 2: ARIA labels and roles
    const chatInput = page.locator('[data-testid="chat-input"]');
    const ariaLabel = await chatInput.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();

    // Test Step 3: Color contrast (amber theme)
    const textElements = page.locator('p, h1, h2, h3, button, input');
    const firstTextElement = textElements.first();
    const styles = await firstTextElement.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor
      };
    });

    // Basic contrast check (proper contrast ratio validation would need additional tools)
    expect(styles.color).not.toBe(styles.backgroundColor);

    // Test Step 4: Screen reader compatibility
    const mainContent = page.locator('main');
    const role = await mainContent.getAttribute('role');
    expect(role === 'main' || await mainContent.evaluate(el => el.tagName.toLowerCase() === 'main')).toBeTruthy();
  });
});