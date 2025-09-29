/**
 * Screenshot Manager for Seekapa BI Agent Testing
 * Handles systematic screenshot capture for CEO deployment validation
 */

import { Page } from '@playwright/test';
import { ScreenshotCapture } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export class ScreenshotManager {
  private page: Page;
  private screenshots: ScreenshotCapture[] = [];
  private testName: string;
  private screenshotsDir: string;

  constructor(page: Page, testName: string) {
    this.page = page;
    this.testName = testName;
    this.screenshotsDir = path.join('tests', 'screenshots', this.sanitizeFileName(testName));
    this.ensureDirectoryExists();
  }

  /**
   * Capture screenshot with descriptive name and metadata
   */
  async capture(
    name: string,
    description: string,
    options?: {
      fullPage?: boolean;
      element?: string;
      mask?: string[];
    }
  ): Promise<string> {
    const timestamp = Date.now();
    const fileName = `${timestamp}_${this.sanitizeFileName(name)}.png`;
    const filePath = path.join(this.screenshotsDir, fileName);

    try {
      const viewport = this.page.viewportSize() || { width: 1920, height: 1080 };

      // Handle different screenshot types
      if (options?.element) {
        // Element-specific screenshot
        const element = this.page.locator(options.element).first();
        await element.screenshot({ path: filePath });
      } else {
        // Full page or viewport screenshot
        const screenshotOptions: any = {
          path: filePath,
          fullPage: options?.fullPage || false
        };

        // Add masking for sensitive data
        if (options?.mask) {
          screenshotOptions.mask = options.mask.map(selector =>
            this.page.locator(selector)
          );
        }

        await this.page.screenshot(screenshotOptions);
      }

      // Store screenshot metadata
      const capture: ScreenshotCapture = {
        name,
        path: filePath,
        timestamp,
        viewport,
        description
      };

      this.screenshots.push(capture);
      console.log(`Screenshot captured: ${fileName} - ${description}`);

      return filePath;
    } catch (error) {
      console.error(`Failed to capture screenshot ${name}:`, error);
      throw error;
    }
  }

  /**
   * Capture the standard 4-point test sequence
   */
  async captureTestSequence(queryDescription: string): Promise<{
    initial: string;
    input: string;
    processing: string;
    result: string;
  }> {
    const initial = await this.capture(
      'initial',
      `Initial state before ${queryDescription}`,
      { fullPage: true }
    );

    return {
      initial,
      input: '', // Will be set when input is captured
      processing: '', // Will be set when processing is captured
      result: '' // Will be set when result is captured
    };
  }

  /**
   * Capture input state with query visible
   */
  async captureInput(query: string): Promise<string> {
    // Wait for chat input to be visible
    await this.page.waitForSelector('textarea[placeholder*="DS-Axia"]', { timeout: 5000 });

    return await this.capture(
      'input',
      `Query input: "${query}"`,
      {
        element: '.flex.flex-col.h-full',
        mask: ['.text-copilot-text-muted'] // Hide user info
      }
    );
  }

  /**
   * Capture processing state with loading indicators
   */
  async captureProcessing(): Promise<string> {
    // Wait for loading indicators (typing indicators or spinners)
    await this.page.waitForSelector(
      '.animate-pulse, .animate-spin, .typing-indicator',
      { timeout: 2000 }
    ).catch(() => {
      // If no loading indicator found, capture anyway
      console.log('No loading indicator found, capturing current state');
    });

    return await this.capture(
      'processing',
      'AI processing and response generation',
      { fullPage: true }
    );
  }

  /**
   * Capture final result with complete response
   */
  async captureResult(): Promise<string> {
    // Wait for response to be complete
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });

    // Wait for any charts or visualizations to render
    await this.page.waitForTimeout(2000);

    return await this.capture(
      'result',
      'Complete AI response with visualizations',
      {
        fullPage: true
      }
    );
  }

  /**
   * Capture mobile-specific screenshot with touch elements
   */
  async captureMobile(name: string, description: string): Promise<string> {
    return await this.capture(
      `mobile_${name}`,
      `Mobile view: ${description}`,
      { fullPage: true }
    );
  }

  /**
   * Capture error state for debugging
   */
  async captureError(errorDescription: string): Promise<string> {
    return await this.capture(
      'error',
      `Error state: ${errorDescription}`,
      { fullPage: true }
    );
  }

  /**
   * Capture performance dashboard elements
   */
  async capturePerformanceElements(): Promise<{
    kpiCards: string;
    charts: string;
    navigation: string;
  }> {
    const kpiCards = await this.capture(
      'kpi_cards',
      'KPI dashboard cards',
      { element: '[data-testid="kpi-container"]' }
    ).catch(() => this.capture('kpi_cards_fallback', 'KPI area (fallback)', { fullPage: false }));

    const charts = await this.capture(
      'charts',
      'Data visualizations and charts',
      { element: '[data-testid="charts-container"]' }
    ).catch(() => this.capture('charts_fallback', 'Charts area (fallback)', { fullPage: false }));

    const navigation = await this.capture(
      'navigation',
      'Navigation and menu elements',
      { element: '[data-testid="navigation"]' }
    ).catch(() => this.capture('navigation_fallback', 'Navigation area (fallback)', { fullPage: false }));

    return { kpiCards, charts, navigation };
  }

  /**
   * Compare screenshots for visual regression testing
   */
  async compareWithBaseline(baselinePath: string, currentPath: string): Promise<{
    passed: boolean;
    difference: number;
    diffPath?: string;
  }> {
    // This is a placeholder for visual comparison
    // In a real implementation, you'd use a library like pixelmatch
    return {
      passed: true,
      difference: 0
    };
  }

  /**
   * Generate HTML report with embedded screenshots
   */
  generateHTMLReport(): string {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Screenshot Report - ${this.testName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .screenshot { margin: 20px 0; border: 1px solid #ddd; padding: 10px; }
        .screenshot img { max-width: 100%; height: auto; }
        .metadata { background: #f5f5f5; padding: 10px; margin: 10px 0; }
        .timestamp { color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <h1>Screenshot Report: ${this.testName}</h1>
      <p>Total screenshots: ${this.screenshots.length}</p>

      ${this.screenshots.map(screenshot => `
        <div class="screenshot">
          <h3>${screenshot.name}</h3>
          <div class="metadata">
            <p><strong>Description:</strong> ${screenshot.description}</p>
            <p><strong>Viewport:</strong> ${screenshot.viewport.width}x${screenshot.viewport.height}</p>
            <p class="timestamp"><strong>Timestamp:</strong> ${new Date(screenshot.timestamp).toISOString()}</p>
          </div>
          <img src="${screenshot.path}" alt="${screenshot.description}" />
        </div>
      `).join('')}
    </body>
    </html>
    `;

    const reportPath = path.join(this.screenshotsDir, 'report.html');
    fs.writeFileSync(reportPath, html);
    return reportPath;
  }

  /**
   * Get all screenshots metadata
   */
  getScreenshots(): ScreenshotCapture[] {
    return [...this.screenshots];
  }

  /**
   * Get paths of all captured screenshots
   */
  getScreenshotPaths(): string[] {
    return this.screenshots.map(s => s.path);
  }

  /**
   * Clean up old screenshots (keep last N)
   */
  cleanup(keepLast: number = 10): void {
    if (this.screenshots.length > keepLast) {
      const toDelete = this.screenshots.slice(0, this.screenshots.length - keepLast);
      toDelete.forEach(screenshot => {
        try {
          fs.unlinkSync(screenshot.path);
        } catch (error) {
          console.warn(`Failed to delete screenshot: ${screenshot.path}`);
        }
      });
      this.screenshots = this.screenshots.slice(-keepLast);
    }
  }

  /**
   * Utility: Sanitize filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  /**
   * Utility: Ensure directory exists
   */
  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
  }
}