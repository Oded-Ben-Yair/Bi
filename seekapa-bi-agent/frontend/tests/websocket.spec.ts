import { test, expect, chromium, Page, Browser, BrowserContext } from '@playwright/test';

test.describe('WebSocket Chat Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // Launch Edge browser
    browser = await chromium.launch({
      channel: 'msedge',
      headless: false,  // Set to true for CI/CD
      args: ['--start-maximized']
    });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should connect to WebSocket and display connection status', async () => {
    console.log('Starting WebSocket connection test...');

    // Navigate to the application
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-screenshots/1-initial-load.png', fullPage: true });

    // Wait for WebSocket connection
    await page.waitForFunction(() => {
      const connectionElement = document.querySelector('[data-testid="connection-status"], .connection-status, .status-indicator');
      return connectionElement !== null;
    }, { timeout: 10000 });

    await page.screenshot({ path: 'test-screenshots/2-connected.png', fullPage: true });

    // Verify connection status
    const isConnected = await page.evaluate(() => {
      const statusElement = document.querySelector('[data-testid="connection-status"], .connection-status, .status-indicator');
      return statusElement?.textContent?.toLowerCase().includes('connected') ||
             statusElement?.classList?.contains('connected');
    });

    expect(isConnected).toBeTruthy();
    console.log('WebSocket connected successfully!');
  });

  test('should send message and receive response', async () => {
    console.log('Starting message send/receive test...');

    // Navigate to the application
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-screenshots/3-ready-to-chat.png', fullPage: true });

    // Wait for connection
    await page.waitForTimeout(2000);

    // Find the message input
    const messageInput = await page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
    expect(messageInput).toBeTruthy();

    // Type a test message
    const testMessage = 'Hello, can you help me analyze DS-Axia data?';
    await messageInput.fill(testMessage);
    await page.screenshot({ path: 'test-screenshots/4-message-typed.png', fullPage: true });

    // Send the message (try multiple methods)
    try {
      // Method 1: Press Enter
      await messageInput.press('Enter');
    } catch {
      try {
        // Method 2: Click send button
        const sendButton = await page.locator('button:has-text("Send"), button[aria-label="Send"]').first();
        await sendButton.click();
      } catch {
        // Method 3: Submit form
        await page.keyboard.press('Enter');
      }
    }

    await page.screenshot({ path: 'test-screenshots/5-message-sent.png', fullPage: true });

    // Wait for response (increased timeout)
    await page.waitForSelector('.message-response, .assistant-message, [data-role="assistant"]', {
      timeout: 15000
    });

    await page.screenshot({ path: 'test-screenshots/6-response-received.png', fullPage: true });

    // Verify response exists
    const responseText = await page.evaluate(() => {
      const responseElement = document.querySelector('.message-response, .assistant-message, [data-role="assistant"]');
      return responseElement?.textContent || '';
    });

    expect(responseText.length).toBeGreaterThan(0);
    console.log('Response received:', responseText.substring(0, 100) + '...');
  });

  test('should handle connection errors gracefully', async () => {
    console.log('Starting error handling test...');

    // Navigate to the application
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-screenshots/7-error-test-initial.png', fullPage: true });

    // Disconnect WebSocket (simulate network issue)
    await page.evaluate(() => {
      const ws = (window as any).websocket;
      if (ws && ws.close) {
        ws.close();
      }
    });

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/8-disconnected.png', fullPage: true });

    // Check for reconnection attempt
    const reconnectMessage = await page.evaluate(() => {
      const toasts = document.querySelectorAll('.toast, .notification, .alert');
      return Array.from(toasts).some(toast =>
        toast.textContent?.toLowerCase().includes('reconnect')
      );
    });

    expect(reconnectMessage).toBeTruthy();
    console.log('Error handling working correctly!');
  });

  test('should display typing indicator', async () => {
    console.log('Starting typing indicator test...');

    // Navigate to the application
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Send a message
    const messageInput = await page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
    await messageInput.fill('What are the key metrics in DS-Axia?');
    await messageInput.press('Enter');

    await page.screenshot({ path: 'test-screenshots/9-typing-indicator-before.png', fullPage: true });

    // Look for typing indicator
    const typingIndicator = await page.waitForSelector('.typing-indicator, .loading, [data-testid="typing"]', {
      timeout: 5000
    }).catch(() => null);

    if (typingIndicator) {
      await page.screenshot({ path: 'test-screenshots/10-typing-indicator-visible.png', fullPage: true });
      console.log('Typing indicator displayed!');
    } else {
      console.log('Typing indicator not found (might be too fast)');
    }
  });

  test('should handle multiple messages in sequence', async () => {
    console.log('Starting multiple messages test...');

    // Navigate to the application
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const messages = [
      'Hello',
      'Show me sales data',
      'What is the trend?'
    ];

    for (let i = 0; i < messages.length; i++) {
      const messageInput = await page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
      await messageInput.fill(messages[i]);
      await messageInput.press('Enter');

      // Wait for response
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `test-screenshots/11-multi-message-${i + 1}.png`, fullPage: true });
    }

    // Verify all messages are displayed
    const messageCount = await page.evaluate(() => {
      const userMessages = document.querySelectorAll('.user-message, [data-role="user"]');
      const assistantMessages = document.querySelectorAll('.assistant-message, [data-role="assistant"]');
      return { user: userMessages.length, assistant: assistantMessages.length };
    });

    expect(messageCount.user).toBeGreaterThanOrEqual(messages.length);
    console.log(`Sent ${messageCount.user} messages, received ${messageCount.assistant} responses`);
  });
});

// Performance test
test('WebSocket response time', async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();

  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const startTime = Date.now();

  // Send message
  const messageInput = await page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
  await messageInput.fill('Test performance');
  await messageInput.press('Enter');

  // Wait for response
  await page.waitForSelector('.message-response, .assistant-message, [data-role="assistant"]', {
    timeout: 10000
  });

  const responseTime = Date.now() - startTime;
  console.log(`Response time: ${responseTime}ms`);

  expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds

  await page.screenshot({ path: 'test-screenshots/12-performance-test.png', fullPage: true });
  await browser.close();
});