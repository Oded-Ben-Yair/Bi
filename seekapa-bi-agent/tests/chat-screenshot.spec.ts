import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Seekapa Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Chat interaction with GPT-5 - Complete Flow', async ({ page }) => {
    console.log('Starting chat interaction test...');

    // Navigate to the application
    await page.goto('http://localhost:5173');

    // Take screenshot of initial state
    await page.screenshot({
      path: 'screenshots/01-initial-load.png',
      fullPage: true
    });
    console.log('✅ Screenshot 1: Initial page loaded');

    // Wait for chat interface to be ready
    await page.waitForSelector('[data-testid="chat-input"], textarea[placeholder*="Ask"], input[placeholder*="Type"], .chat-input, #message-input', {
      timeout: 10000
    }).catch(async () => {
      // If no test ID, try common selectors
      const selectors = [
        'textarea',
        'input[type="text"]',
        '.message-input',
        '.chat-input',
        '[contenteditable="true"]'
      ];

      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) {
          console.log(`Found input with selector: ${selector}`);
          return element;
        }
      }
    });

    await page.screenshot({
      path: 'screenshots/02-chat-ready.png',
      fullPage: true
    });
    console.log('✅ Screenshot 2: Chat interface ready');

    // Find and click the input field
    const inputSelector = await page.evaluateHandle(() => {
      const selectors = [
        '[data-testid="chat-input"]',
        'textarea[placeholder*="Ask"]',
        'input[placeholder*="Type"]',
        '.chat-input',
        '#message-input',
        'textarea',
        'input[type="text"]'
      ];

      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return sel;
      }
      return null;
    });

    const selector = await inputSelector.jsonValue();
    console.log(`Using input selector: ${selector}`);

    // Type the test message
    const testMessage = "What is the total revenue in the Axia dataset?";
    await page.fill(selector as string, testMessage);

    await page.screenshot({
      path: 'screenshots/03-message-typed.png',
      fullPage: true
    });
    console.log(`✅ Screenshot 3: Typed message: "${testMessage}"`);

    // Find and click send button or press Enter
    const sendButton = await page.$('[data-testid="send-button"], button[aria-label*="Send"], button:has-text("Send"), .send-button, button[type="submit"]');

    if (sendButton) {
      await sendButton.click();
      console.log('Clicked send button');
    } else {
      // Press Enter to send
      await page.keyboard.press('Enter');
      console.log('Pressed Enter to send');
    }

    await page.screenshot({
      path: 'screenshots/04-message-sent.png',
      fullPage: true
    });
    console.log('✅ Screenshot 4: Message sent');

    // Wait for typing indicator (three dots)
    await page.waitForTimeout(500);

    // Check for typing indicator
    const typingIndicator = await page.$('.typing-indicator, .dots-loading, [data-testid="typing-indicator"], .loading');
    if (typingIndicator) {
      await page.screenshot({
        path: 'screenshots/05-typing-indicator.png',
        fullPage: true
      });
      console.log('✅ Screenshot 5: Typing indicator visible (three dots)');
    }

    // Wait for response with longer timeout
    console.log('⏳ Waiting for AI response...');

    try {
      // Wait for assistant message to appear
      await page.waitForSelector('.assistant-message, .ai-response, [data-role="assistant"], .message-assistant', {
        timeout: 30000
      });

      await page.screenshot({
        path: 'screenshots/06-response-received.png',
        fullPage: true
      });
      console.log('✅ Screenshot 6: Response received from AI');

      // Get the response text
      const responseText = await page.evaluate(() => {
        const selectors = [
          '.assistant-message',
          '.ai-response',
          '[data-role="assistant"]',
          '.message-assistant'
        ];

        for (const sel of selectors) {
          const elements = document.querySelectorAll(sel);
          if (elements.length > 0) {
            const lastElement = elements[elements.length - 1];
            return lastElement.textContent;
          }
        }
        return null;
      });

      console.log('📝 AI Response:', responseText?.substring(0, 200) + '...');

      // Verify response contains expected content
      expect(responseText).toBeTruthy();
      expect(responseText?.length).toBeGreaterThan(10);

      await page.screenshot({
        path: 'screenshots/07-test-complete.png',
        fullPage: true
      });
      console.log('✅ Screenshot 7: Test completed successfully');

    } catch (error) {
      // Response timeout - capture failure state
      await page.screenshot({
        path: 'screenshots/ERROR-no-response.png',
        fullPage: true
      });
      console.error('❌ ERROR: No response received within 30 seconds');
      console.error('This is the issue the user reported: typing indicator appears then disappears with no response');

      // Check console for errors
      const consoleErrors = await page.evaluate(() => {
        return (window as any).__consoleErrors || [];
      });

      if (consoleErrors.length > 0) {
        console.error('Console errors found:', consoleErrors);
      }

      throw new Error('Chat response not received - WebSocket issue confirmed');
    }
  });

  test('Capture WebSocket Network Activity', async ({ page }) => {
    // Enable request/response logging
    const wsMessages: any[] = [];

    page.on('websocket', ws => {
      console.log(`WebSocket opened: ${ws.url()}`);

      ws.on('framesent', event => {
        console.log('→ WS Sent:', event.payload);
        wsMessages.push({ type: 'sent', data: event.payload });
      });

      ws.on('framereceived', event => {
        console.log('← WS Received:', event.payload);
        wsMessages.push({ type: 'received', data: event.payload });
      });

      ws.on('close', () => {
        console.log('WebSocket closed');
      });
    });

    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);

    // Try to send a message
    const inputSelector = 'textarea, input[type="text"], .chat-input';
    await page.fill(inputSelector, 'Test WebSocket connection');
    await page.keyboard.press('Enter');

    // Wait to capture WebSocket activity
    await page.waitForTimeout(5000);

    await page.screenshot({
      path: 'screenshots/websocket-test.png',
      fullPage: true
    });

    console.log('WebSocket messages captured:', wsMessages.length);
    wsMessages.forEach((msg, i) => {
      console.log(`${i + 1}. ${msg.type}: ${msg.data}`);
    });
  });
});