/**
 * Smart Locators - Self-Healing Test Framework
 * Intelligent element location with automatic fallback strategies and self-repair capabilities
 */

import { Page, Locator } from '@playwright/test';

export interface LocatorStrategy {
  name: string;
  selector: string;
  weight: number; // Higher weight = higher priority
  reliability: number; // 0-1 scale, updated based on success/failure
}

export interface SmartLocatorOptions {
  timeout?: number;
  retries?: number;
  captureFailures?: boolean;
  healingEnabled?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export class SmartLocator {
  private page: Page;
  private strategies: LocatorStrategy[];
  private options: SmartLocatorOptions;
  private healingLog: Array<{ strategy: string; success: boolean; timestamp: Date; error?: string }> = [];

  constructor(page: Page, strategies: LocatorStrategy[], options: SmartLocatorOptions = {}) {
    this.page = page;
    this.strategies = [...strategies].sort((a, b) => (b.weight * b.reliability) - (a.weight * a.reliability));
    this.options = {
      timeout: 5000,
      retries: 3,
      captureFailures: true,
      healingEnabled: true,
      logLevel: 'info',
      ...options
    };
  }

  /**
   * Locate element using smart strategy selection with self-healing
   */
  async locate(): Promise<Locator> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= (this.options.retries || 3); attempt++) {
      for (const strategy of this.strategies) {
        try {
          this.log('debug', `Attempting strategy: ${strategy.name} - ${strategy.selector}`);

          const locator = this.page.locator(strategy.selector);

          // Test if element is found and visible
          await locator.first().waitFor({
            state: 'visible',
            timeout: this.options.timeout
          });

          // Update reliability on success
          this.updateReliability(strategy, true);
          this.healingLog.push({
            strategy: strategy.name,
            success: true,
            timestamp: new Date()
          });

          this.log('info', `Successfully located element using strategy: ${strategy.name}`);

          // Re-sort strategies based on updated reliability
          this.reorderStrategies();

          return locator;

        } catch (error) {
          lastError = error as Error;

          // Update reliability on failure
          this.updateReliability(strategy, false);
          this.healingLog.push({
            strategy: strategy.name,
            success: false,
            timestamp: new Date(),
            error: lastError.message
          });

          this.log('warn', `Strategy failed: ${strategy.name} - ${lastError.message}`);

          // Capture screenshot on failure if enabled
          if (this.options.captureFailures) {
            await this.captureFailureScreenshot(strategy.name);
          }
        }
      }

      // Attempt self-healing between retries
      if (attempt < (this.options.retries || 3) && this.options.healingEnabled) {
        await this.attemptSelfHealing();
      }
    }

    // All strategies failed
    this.log('error', `All location strategies failed. Last error: ${lastError?.message}`);
    throw new Error(`SmartLocator failed to find element after ${this.options.retries} retries. Strategies tried: ${this.strategies.map(s => s.name).join(', ')}`);
  }

  /**
   * Add a new locator strategy
   */
  addStrategy(strategy: LocatorStrategy): void {
    // Initialize reliability if not set
    if (!strategy.reliability) {
      strategy.reliability = 0.8; // Default reliability
    }

    this.strategies.push(strategy);
    this.reorderStrategies();
  }

  /**
   * Remove a strategy by name
   */
  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter(s => s.name !== strategyName);
  }

  /**
   * Get current strategy performance report
   */
  getPerformanceReport(): any {
    const totalAttempts = this.healingLog.length;
    const successfulAttempts = this.healingLog.filter(log => log.success).length;

    const strategyStats = this.strategies.map(strategy => {
      const strategyLogs = this.healingLog.filter(log => log.strategy === strategy.name);
      const strategySuccesses = strategyLogs.filter(log => log.success).length;

      return {
        name: strategy.name,
        selector: strategy.selector,
        weight: strategy.weight,
        reliability: strategy.reliability,
        attempts: strategyLogs.length,
        successes: strategySuccesses,
        successRate: strategyLogs.length > 0 ? (strategySuccesses / strategyLogs.length) : 0
      };
    });

    return {
      totalAttempts,
      successfulAttempts,
      overallSuccessRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : 0,
      strategies: strategyStats,
      recentActivity: this.healingLog.slice(-10) // Last 10 attempts
    };
  }

  /**
   * Update strategy reliability based on success/failure
   */
  private updateReliability(strategy: LocatorStrategy, success: boolean): void {
    const learningRate = 0.1;
    const target = success ? 1.0 : 0.0;

    strategy.reliability = strategy.reliability + learningRate * (target - strategy.reliability);
    strategy.reliability = Math.max(0.1, Math.min(1.0, strategy.reliability)); // Keep between 0.1 and 1.0
  }

  /**
   * Reorder strategies based on weight * reliability
   */
  private reorderStrategies(): void {
    this.strategies.sort((a, b) => (b.weight * b.reliability) - (a.weight * a.reliability));
  }

  /**
   * Attempt to heal broken locators by discovering new selectors
   */
  private async attemptSelfHealing(): Promise<void> {
    this.log('info', 'Attempting self-healing...');

    try {
      // Strategy 1: Look for elements with common patterns
      const commonPatterns = [
        '[data-testid*="chat"]',
        '[class*="chat"]',
        '[id*="chat"]',
        'input[type="text"]',
        'textarea',
        'button[type="submit"]',
        '.send-button',
        '#send-button'
      ];

      for (const pattern of commonPatterns) {
        try {
          const elements = await this.page.locator(pattern).all();
          if (elements.length > 0) {
            // Add as a new strategy with lower weight
            this.addStrategy({
              name: `auto-discovered-${Date.now()}`,
              selector: pattern,
              weight: 3, // Lower priority than manually defined
              reliability: 0.6 // Conservative initial reliability
            });

            this.log('info', `Self-healing: Discovered potential selector: ${pattern}`);
          }
        } catch (error) {
          // Ignore discovery failures
        }
      }

      // Strategy 2: Look for similar elements by text content
      await this.discoverByText();

      // Strategy 3: Look for elements by position
      await this.discoverByPosition();

    } catch (error) {
      this.log('warn', `Self-healing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Discover elements by text content
   */
  private async discoverByText(): Promise<void> {
    const commonTexts = [
      'Send', 'Submit', 'Search', 'Enter', 'Go',
      'Chat', 'Message', 'Type a message', 'Ask me anything'
    ];

    for (const text of commonTexts) {
      try {
        const byText = this.page.getByText(text, { exact: false });
        const elements = await byText.all();

        if (elements.length > 0) {
          this.addStrategy({
            name: `text-discovery-${text.toLowerCase().replace(/\s+/g, '-')}`,
            selector: `text=${text}`,
            weight: 4,
            reliability: 0.7
          });

          this.log('info', `Self-healing: Discovered element by text: "${text}"`);
        }
      } catch (error) {
        // Ignore
      }
    }
  }

  /**
   * Discover elements by position (last resort)
   */
  private async discoverByPosition(): Promise<void> {
    try {
      // Look for buttons in the bottom right (common for send buttons)
      const rightBottomButtons = await this.page.locator('button').all();

      for (let i = 0; i < Math.min(3, rightBottomButtons.length); i++) {
        const button = rightBottomButtons[i];
        const boundingBox = await button.boundingBox();

        if (boundingBox && boundingBox.x > 500 && boundingBox.y > 400) {
          // This might be a send button
          const buttonId = await button.getAttribute('id');
          const buttonClass = await button.getAttribute('class');

          if (buttonId) {
            this.addStrategy({
              name: `position-discovery-id-${buttonId}`,
              selector: `#${buttonId}`,
              weight: 2,
              reliability: 0.5
            });
          } else if (buttonClass) {
            this.addStrategy({
              name: `position-discovery-class-${buttonClass.split(' ')[0]}`,
              selector: `.${buttonClass.split(' ')[0]}`,
              weight: 2,
              reliability: 0.5
            });
          }
        }
      }
    } catch (error) {
      // Ignore position discovery failures
    }
  }

  /**
   * Capture screenshot on failure for debugging
   */
  private async captureFailureScreenshot(strategyName: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `failure-${strategyName}-${timestamp}.png`;
      await this.page.screenshot({ path: `test-results/healing-failures/${filename}` });
      this.log('debug', `Captured failure screenshot: ${filename}`);
    } catch (error) {
      this.log('warn', `Failed to capture screenshot: ${(error as Error).message}`);
    }
  }

  /**
   * Logging with level control
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.options.logLevel || 'info'];

    if (levels[level] >= currentLevel) {
      console.log(`[SmartLocator ${level.toUpperCase()}] ${message}`);
    }
  }
}

/**
 * Factory for common UI element smart locators
 */
export class SmartLocatorFactory {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Smart locator for chat input field
   */
  chatInput(options?: SmartLocatorOptions): SmartLocator {
    const strategies: LocatorStrategy[] = [
      { name: 'primary-testid', selector: '[data-testid="chat-input"]', weight: 10, reliability: 0.95 },
      { name: 'secondary-testid', selector: '[data-testid*="input"]', weight: 8, reliability: 0.85 },
      { name: 'textarea-class', selector: 'textarea.chat-input', weight: 7, reliability: 0.8 },
      { name: 'generic-textarea', selector: 'textarea', weight: 6, reliability: 0.7 },
      { name: 'placeholder-text', selector: 'input[placeholder*="message"]', weight: 5, reliability: 0.75 },
      { name: 'aria-label', selector: '[aria-label*="chat" i]', weight: 4, reliability: 0.7 },
      { name: 'role-textbox', selector: '[role="textbox"]', weight: 3, reliability: 0.6 }
    ];

    return new SmartLocator(this.page, strategies, options);
  }

  /**
   * Smart locator for send button
   */
  sendButton(options?: SmartLocatorOptions): SmartLocator {
    const strategies: LocatorStrategy[] = [
      { name: 'primary-testid', selector: '[data-testid="send-button"]', weight: 10, reliability: 0.95 },
      { name: 'secondary-testid', selector: '[data-testid*="send"]', weight: 8, reliability: 0.85 },
      { name: 'button-text', selector: 'button:has-text("Send")', weight: 7, reliability: 0.8 },
      { name: 'submit-button', selector: 'button[type="submit"]', weight: 6, reliability: 0.75 },
      { name: 'send-class', selector: '.send-button', weight: 5, reliability: 0.7 },
      { name: 'aria-label', selector: '[aria-label*="send" i]', weight: 4, reliability: 0.7 }
    ];

    return new SmartLocator(this.page, strategies, options);
  }

  /**
   * Smart locator for KPI cards
   */
  kpiCard(index?: number, options?: SmartLocatorOptions): SmartLocator {
    const baseStrategies: LocatorStrategy[] = [
      { name: 'primary-testid', selector: '[data-testid="kpi-card"]', weight: 10, reliability: 0.95 },
      { name: 'secondary-testid', selector: '[data-testid*="kpi"]', weight: 8, reliability: 0.85 },
      { name: 'card-class', selector: '.kpi-card', weight: 7, reliability: 0.8 },
      { name: 'metric-card', selector: '.metric-card', weight: 6, reliability: 0.75 },
      { name: 'dashboard-card', selector: '.dashboard-card', weight: 5, reliability: 0.7 }
    ];

    // Modify selectors for specific index
    const strategies = baseStrategies.map(strategy => ({
      ...strategy,
      selector: index !== undefined ?
        `${strategy.selector}:nth-child(${index + 1})` :
        strategy.selector
    }));

    return new SmartLocator(this.page, strategies, options);
  }

  /**
   * Smart locator for message elements
   */
  messageElement(role?: 'user' | 'assistant', options?: SmartLocatorOptions): SmartLocator {
    const roleSelector = role ? `[data-role="${role}"]` : '';

    const strategies: LocatorStrategy[] = [
      { name: 'primary-testid', selector: `[data-testid="message"]${roleSelector}`, weight: 10, reliability: 0.95 },
      { name: 'message-class', selector: `.message${role ? `.${role}` : ''}`, weight: 7, reliability: 0.8 },
      { name: 'chat-message', selector: `.chat-message${roleSelector}`, weight: 6, reliability: 0.75 },
      { name: 'generic-message', selector: `.message-content${roleSelector}`, weight: 5, reliability: 0.7 }
    ];

    return new SmartLocator(this.page, strategies, options);
  }
}

/**
 * Test utility for verifying self-healing functionality
 */
export class HealingTestUtils {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Simulate UI changes that break locators (for testing purposes)
   */
  async breakLocators(elementTestId: string): Promise<void> {
    await this.page.evaluate((testId) => {
      const element = document.querySelector(`[data-testid="${testId}"]`);
      if (element) {
        // Remove test id
        element.removeAttribute('data-testid');
        // Change class names
        element.className = element.className.replace(/[\w-]+/g, 'changed-class-name');
        // Change id if present
        if (element.id) {
          element.id = 'changed-id-name';
        }
      }
    }, elementTestId);
  }

  /**
   * Verify healing report contains expected data
   */
  verifyHealingReport(report: any): boolean {
    return (
      typeof report.totalAttempts === 'number' &&
      typeof report.successfulAttempts === 'number' &&
      typeof report.overallSuccessRate === 'number' &&
      Array.isArray(report.strategies) &&
      Array.isArray(report.recentActivity)
    );
  }
}