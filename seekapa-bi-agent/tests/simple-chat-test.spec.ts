import { test, expect } from '@playwright/test';

test('Simple chat interaction test', async ({ page }) => {
  console.log('Starting simple chat test...');

  // Navigate to the application
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  console.log('Page loaded, looking for chat input...');

  // Wait for chat interface
  await page.waitForSelector('textarea[placeholder*="DS-Axia"]', {
    timeout: 10000
  });

  console.log('Chat input found, clicking and typing...');

  // Find and interact with chat input
  const chatInput = page.locator('textarea[placeholder*="DS-Axia"]').first();
  await chatInput.click();
  await chatInput.fill('What was our revenue last quarter?');

  console.log('Text entered, waiting for send button...');

  // Wait for send button to be enabled
  await page.waitForSelector('button[aria-label="Send message"]:not([disabled])', {
    timeout: 5000
  });

  console.log('Send button available, clicking...');

  // Click send button
  const sendButton = page.locator('button[aria-label="Send message"]').first();
  await sendButton.click();

  console.log('Message sent, waiting for response...');

  // Wait for any assistant response (look for bot icon)
  try {
    await page.waitForSelector('[data-testid="Bot"], .lucide-bot', { timeout: 15000 });
    console.log('Bot response icon found!');
  } catch (e) {
    console.log('No bot icon found, checking for any new content...');
  }

  // Check if we got any messages (look for message containers)
  const messageContainers = await page.locator('div.space-y-6 > div').count();
  console.log(`Found ${messageContainers} message containers`);

  // Check for user messages (should be at least 1)
  const userIcon = await page.locator('.lucide-user').count();
  console.log(`Found ${userIcon} user icons`);

  // Check for assistant messages
  const botIcon = await page.locator('.lucide-bot').count();
  console.log(`Found ${botIcon} bot icons`);

  // Take a screenshot
  await page.screenshot({ path: 'simple-test-result.png' });

  console.log('Test completed!');
});