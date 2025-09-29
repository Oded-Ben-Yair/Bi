import { test, expect } from '@playwright/test';

test('Quick GPT-5 validation', async ({ page }) => {
  console.log('🚀 Quick GPT-5 Validation Test');

  // Navigate to the application
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  console.log('🌐 Page loaded successfully');

  // Wait for chat interface
  await page.waitForSelector('textarea[placeholder*="DS-Axia"]', {
    timeout: 10000
  });

  console.log('💬 Chat interface ready');

  // Find and interact with chat input
  const chatInput = page.locator('textarea[placeholder*="DS-Axia"]').first();
  await chatInput.click();
  await chatInput.fill('What was our revenue last quarter?');

  console.log('📝 Query entered');

  // Wait for send button to be enabled
  await page.waitForSelector('button[aria-label="Send message"]:not([disabled])', {
    timeout: 5000
  });

  // Click send button
  const sendButton = page.locator('button[aria-label="Send message"]').first();
  await sendButton.click();

  console.log('📤 Message sent');

  // Wait for response with bot icon
  try {
    await page.waitForSelector('.lucide-bot', { timeout: 15000 });
    console.log('🤖 Bot response detected!');

    // Extract response text
    const assistantContainer = page.locator('div.space-y-6 > div').filter({
      has: page.locator('.lucide-bot')
    }).first();

    const responseText = await assistantContainer.locator('div.markdown-content, p').textContent();
    console.log(`✅ Response: ${responseText?.substring(0, 200)}...`);

    // Basic validation
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(10);

    console.log('🎉 GPT-5 integration working!');
  } catch (error) {
    console.log(`❌ No bot response: ${error}`);
    await page.screenshot({ path: 'quick-test-failed.png' });
    throw error;
  }

  await page.screenshot({ path: 'quick-test-success.png' });
});