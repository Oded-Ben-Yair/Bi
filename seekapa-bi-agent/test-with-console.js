const { chromium } = require('playwright');

(async () => {
  console.log('Starting test with console logging...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Capture all console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    console.log(`Browser console: ${text}`);
  });

  // Capture any errors
  page.on('pageerror', error => {
    console.log('❌ Page error:', error.message);
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');

  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({ path: 'test-1-initial.png', fullPage: true });
  console.log('✅ Screenshot 1: Initial page');

  // Type a message
  const textarea = await page.locator('textarea');
  await textarea.fill('What is the total revenue in the Axia dataset?');
  console.log('✅ Message typed');

  await page.screenshot({ path: 'test-2-typed.png', fullPage: true });

  // Send the message
  await page.keyboard.press('Enter');
  console.log('✅ Message sent');

  await page.screenshot({ path: 'test-3-sent.png', fullPage: true });

  // Wait for response (longer timeout)
  console.log('⏳ Waiting for response...');
  await page.waitForTimeout(10000);

  await page.screenshot({ path: 'test-4-response.png', fullPage: true });

  // Check if any assistant messages exist in DOM
  const assistantMessages = await page.$$('[data-role="assistant"]');
  console.log(`Found ${assistantMessages.length} assistant messages in DOM`);

  // Check messages in the store via console
  const storeMessages = await page.evaluate(() => {
    // Try to access the store if it's exposed
    return window.useAppStore?.getState?.()?.messages || [];
  });
  console.log('Store messages:', storeMessages);

  // Save all console logs to file
  const fs = require('fs');
  fs.writeFileSync('console-output.txt', consoleLogs.join('\n'));
  console.log('✅ Console logs saved to console-output.txt');

  await browser.close();
  console.log('✅ Test complete!');
})();