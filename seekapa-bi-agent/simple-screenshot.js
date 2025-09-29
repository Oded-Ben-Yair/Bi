const { chromium } = require('playwright');

(async () => {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Take initial screenshot
  await page.screenshot({ path: 'frontend-initial.png', fullPage: true });
  console.log('✅ Screenshot 1: Initial page saved to frontend-initial.png');

  // Find chat input - try multiple selectors
  const selectors = [
    'textarea',
    'input[type="text"]',
    '.chat-input',
    '[placeholder*="Type"]',
    '[placeholder*="Ask"]',
    '[placeholder*="Message"]'
  ];

  let inputFound = false;
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        console.log(`Found input with selector: ${selector}`);

        // Type a message
        await page.fill(selector, 'What is the total revenue in the Axia dataset?');
        console.log('✅ Message typed');

        await page.screenshot({ path: 'frontend-typed.png', fullPage: true });
        console.log('✅ Screenshot 2: Message typed saved to frontend-typed.png');

        // Press Enter to send
        await page.keyboard.press('Enter');
        console.log('✅ Message sent');

        inputFound = true;
        break;
      }
    } catch (e) {
      // Try next selector
    }
  }

  if (!inputFound) {
    console.log('❌ Could not find chat input');
    await page.screenshot({ path: 'frontend-no-input.png', fullPage: true });
  }

  // Wait for response
  console.log('⏳ Waiting for response...');
  await page.waitForTimeout(8000);

  // Take final screenshot
  await page.screenshot({ path: 'frontend-final.png', fullPage: true });
  console.log('✅ Screenshot 3: Final state saved to frontend-final.png');

  // Check for response
  const pageContent = await page.content();
  if (pageContent.includes('revenue') || pageContent.includes('Axia') || pageContent.includes('dataset')) {
    console.log('✅ Response detected in page content!');
  } else {
    console.log('⚠️ No obvious response found in page content');
  }

  await browser.close();
  console.log('✅ Test complete!');
})();