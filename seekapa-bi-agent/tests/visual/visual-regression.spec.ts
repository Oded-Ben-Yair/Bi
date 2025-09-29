/**
 * Visual Regression Tests
 * Comprehensive visual testing for CEO dashboard with 0.1% threshold
 */

import { test, expect, Page } from '@playwright/test';

// Visual regression configuration
const VISUAL_THRESHOLD = 0.001; // 0.1% threshold as required
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 1024, height: 1366 },
  mobile: { width: 390, height: 844 }
};

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application and wait for full load
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for all dynamic content to settle
    await page.waitForTimeout(2000);
  });

  test('CEO Dashboard - Desktop Full Page', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Wait for KPI cards to load with data
    await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(4);
    await page.waitForTimeout(1000); // Let animations settle

    // Hide dynamic elements that change between runs
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="last-updated"],
        .loading-animation {
          visibility: hidden !important;
        }
      `
    });

    await expect(page).toHaveScreenshot('ceo-dashboard-desktop.png', {
      threshold: VISUAL_THRESHOLD,
      fullPage: true
    });
  });

  test('CEO Dashboard - Tablet View', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);

    await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(4);
    await page.waitForTimeout(1000);

    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="last-updated"] {
          visibility: hidden !important;
        }
      `
    });

    await expect(page).toHaveScreenshot('ceo-dashboard-tablet.png', {
      threshold: VISUAL_THRESHOLD,
      fullPage: true
    });
  });

  test('CEO Dashboard - Mobile View', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await expect(page.locator('[data-testid="kpi-card"]')).toHaveCount(4);

    // Open mobile menu if needed
    const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await page.waitForTimeout(300); // Animation time
    }

    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="last-updated"] {
          visibility: hidden !important;
        }
      `
    });

    await expect(page).toHaveScreenshot('ceo-dashboard-mobile.png', {
      threshold: VISUAL_THRESHOLD,
      fullPage: true
    });
  });

  test('Chat Interface - Empty State', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toBeVisible();

    // Focus the chat input to show placeholder
    await page.locator('[data-testid="chat-input"]').focus();

    await expect(chatInterface).toHaveScreenshot('chat-interface-empty.png', {
      threshold: VISUAL_THRESHOLD
    });
  });

  test('Chat Interface - With Messages', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Add test messages to chat
    await page.locator('[data-testid="chat-input"]').fill('What are our top revenue streams?');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for user message to appear
    await expect(page.locator('[data-testid="message"][data-role="user"]')).toBeVisible();

    // Simulate AI response (in real test, this would come from WebSocket)
    await page.evaluate(() => {
      const messageContainer = document.querySelector('[data-testid="message-list"]');
      if (messageContainer) {
        const aiMessage = document.createElement('div');
        aiMessage.setAttribute('data-testid', 'message');
        aiMessage.setAttribute('data-role', 'assistant');
        aiMessage.innerHTML = `
          <div class="message-content">
            <p>Based on our latest data analysis, here are the top 5 revenue streams:</p>
            <ol>
              <li>Enterprise Software Licenses: $2.4M</li>
              <li>Professional Services: $1.8M</li>
              <li>Cloud Infrastructure: $1.2M</li>
              <li>Data Analytics Platform: $950K</li>
              <li>Training & Certification: $600K</li>
            </ol>
          </div>
        `;
        messageContainer.appendChild(aiMessage);
      }
    });

    await page.waitForTimeout(500);

    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toHaveScreenshot('chat-interface-with-messages.png', {
      threshold: VISUAL_THRESHOLD
    });
  });

  test('KPI Cards - Individual Components', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const kpiCards = page.locator('[data-testid="kpi-card"]');
    await expect(kpiCards).toHaveCount(4);

    // Test each KPI card individually
    for (let i = 0; i < 4; i++) {
      const card = kpiCards.nth(i);
      await expect(card).toBeVisible();

      // Hide timestamp elements
      await card.locator('[data-testid="timestamp"]').evaluate(el => {
        if (el) el.style.visibility = 'hidden';
      });

      await expect(card).toHaveScreenshot(`kpi-card-${i + 1}.png`, {
        threshold: VISUAL_THRESHOLD
      });
    }
  });

  test('Header Component - All States', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const header = page.locator('[data-testid="header"]');
    await expect(header).toBeVisible();

    // Test normal state
    await expect(header).toHaveScreenshot('header-normal.png', {
      threshold: VISUAL_THRESHOLD
    });

    // Test with user menu open (if exists)
    const userMenuButton = page.locator('[data-testid="user-menu-button"]');
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
      await page.waitForTimeout(300);

      await expect(header).toHaveScreenshot('header-user-menu-open.png', {
        threshold: VISUAL_THRESHOLD
      });
    }
  });

  test('Sidebar Navigation - Collapsed and Expanded', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Test expanded state
    await expect(sidebar).toHaveScreenshot('sidebar-expanded.png', {
      threshold: VISUAL_THRESHOLD
    });

    // Test collapsed state (if toggle exists)
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await page.waitForTimeout(300); // Animation time

      await expect(sidebar).toHaveScreenshot('sidebar-collapsed.png', {
        threshold: VISUAL_THRESHOLD
      });
    }
  });

  test('Dark Mode vs Light Mode', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Test light mode (default)
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    await page.addStyleTag({
      content: `
        [data-testid="timestamp"],
        [data-testid="last-updated"] {
          visibility: hidden !important;
        }
      `
    });

    await expect(page).toHaveScreenshot('dashboard-light-mode.png', {
      threshold: VISUAL_THRESHOLD,
      fullPage: true
    });

    // Toggle to dark mode (if available)
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Theme transition time

      await expect(page).toHaveScreenshot('dashboard-dark-mode.png', {
        threshold: VISUAL_THRESHOLD,
        fullPage: true
      });
    }
  });

  test('Loading States - Visual Consistency', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Intercept API calls to delay responses
    await page.route('**/api/**', route => {
      setTimeout(() => route.continue(), 2000); // 2 second delay
    });

    await page.goto('/');

    // Capture loading state
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

    await expect(page).toHaveScreenshot('dashboard-loading-state.png', {
      threshold: VISUAL_THRESHOLD,
      fullPage: true
    });
  });

  test('Error States - Visual Display', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Mock API error
    await page.route('**/api/chat', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Service temporarily unavailable' })
      });
    });

    // Trigger error by sending message
    await page.locator('[data-testid="chat-input"]').fill('Test error message');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for error message to appear
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    const chatInterface = page.locator('[data-testid="chat-interface"]');
    await expect(chatInterface).toHaveScreenshot('chat-error-state.png', {
      threshold: VISUAL_THRESHOLD
    });
  });

  test('Responsive Breakpoints - Visual Transitions', async ({ page }) => {
    const breakpoints = [
      { name: 'mobile', width: 390 },
      { name: 'tablet', width: 768 },
      { name: 'laptop', width: 1024 },
      { name: 'desktop', width: 1440 },
      { name: 'large-desktop', width: 1920 }
    ];

    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ width: breakpoint.width, height: 1080 });

      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
      await page.waitForTimeout(500); // Layout adjustment time

      // Hide dynamic elements
      await page.addStyleTag({
        content: `
          [data-testid="timestamp"],
          [data-testid="last-updated"] {
            visibility: hidden !important;
          }
        `
      });

      await expect(page).toHaveScreenshot(`responsive-${breakpoint.name}.png`, {
        threshold: VISUAL_THRESHOLD,
        fullPage: true
      });
    }
  });

  test('Component Focus States - Accessibility', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Test chat input focus
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.focus();
    await page.waitForTimeout(200);

    await expect(chatInput).toHaveScreenshot('chat-input-focused.png', {
      threshold: VISUAL_THRESHOLD
    });

    // Test send button focus
    const sendButton = page.locator('[data-testid="send-button"]');
    await sendButton.focus();
    await page.waitForTimeout(200);

    await expect(sendButton).toHaveScreenshot('send-button-focused.png', {
      threshold: VISUAL_THRESHOLD
    });

    // Test KPI card focus (if focusable)
    const firstKpiCard = page.locator('[data-testid="kpi-card"]').first();
    await firstKpiCard.focus();
    await page.waitForTimeout(200);

    await expect(firstKpiCard).toHaveScreenshot('kpi-card-focused.png', {
      threshold: VISUAL_THRESHOLD
    });
  });

  test('Animation States - Mid-transition Capture', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Capture tooltip animation
    const kpiCard = page.locator('[data-testid="kpi-card"]').first();

    // Hover to trigger tooltip
    await kpiCard.hover();
    await page.waitForTimeout(150); // Capture mid-animation

    await expect(kpiCard).toHaveScreenshot('kpi-tooltip-animation.png', {
      threshold: VISUAL_THRESHOLD
    });

    // Test sidebar collapse animation
    const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
      await page.waitForTimeout(150); // Mid-animation capture

      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toHaveScreenshot('sidebar-collapse-animation.png', {
        threshold: VISUAL_THRESHOLD
      });
    }
  });
});