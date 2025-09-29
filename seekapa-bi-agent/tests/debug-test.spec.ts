import { test, expect } from '@playwright/test';

test('Debug page elements', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(5000);

  console.log('Textarea count:', await page.locator('textarea').count());
  console.log('Input count:', await page.locator('input').count());
  console.log('Button count:', await page.locator('button').count());

  // Check for specific elements
  const textareas = await page.locator('textarea').all();
  for (let i = 0; i < textareas.length; i++) {
    const placeholder = await textareas[i].getAttribute('placeholder');
    console.log(`Textarea ${i}: placeholder="${placeholder}"`);
  }

  const buttons = await page.locator('button').all();
  for (let i = 0; i < buttons.length; i++) {
    const ariaLabel = await buttons[i].getAttribute('aria-label');
    const text = await buttons[i].textContent();
    console.log(`Button ${i}: aria-label="${ariaLabel}", text="${text}"`);
  }

  // Check for Send icon button specifically
  const sendButton = await page.locator('button[aria-label="Send message"]').count();
  console.log('Send message button count:', sendButton);

  // Check for buttons containing Send icon (SVG)
  const sendIconButton = await page.locator('button:has(svg)').count();
  console.log('Buttons with SVG icons:', sendIconButton);

  await page.screenshot({ path: 'debug.png' });
});