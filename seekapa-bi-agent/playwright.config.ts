import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Seekapa BI Agent Testing
 * Optimized for CEO deployment validation with Edge browser
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30000, // 30 seconds for CEO-level queries
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },
  fullyParallel: false, // Sequential execution to avoid resource conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for sequential testing
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line']
  ],
  use: {
    // Global test settings
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // CEO-focused viewport (executive desktop)
    viewport: { width: 1920, height: 1080 },
    // Professional business context
    locale: 'en-US',
    timezoneId: 'America/New_York'
  },

  projects: [
    {
      name: 'ceo-desktop-edge',
      use: {
        ...devices['Desktop Edge'],
        // Force use of system Edge browser
        channel: 'msedge',
        // CEO desktop settings
        viewport: { width: 1920, height: 1080 },
        // Enhanced screenshot settings for documentation
        screenshot: 'on',
        video: 'on'
      },
    },
    {
      name: 'ceo-mobile-edge',
      use: {
        ...devices['iPhone 12'],
        // Use Edge mobile for consistency
        channel: 'msedge',
        // Mobile CEO access
        viewport: { width: 390, height: 844 },
        screenshot: 'on',
        video: 'on'
      },
    },
    {
      name: 'ceo-tablet-edge',
      use: {
        ...devices['iPad Pro'],
        channel: 'msedge',
        // Tablet executive view
        viewport: { width: 1024, height: 1366 },
        screenshot: 'on',
        video: 'on'
      },
    }
  ],

  // Development server (frontend already running on 5173)
  webServer: {
    command: 'echo "Using existing dev server"',
    port: 5173,
    reuseExistingServer: true,
    timeout: 5000
  }
});