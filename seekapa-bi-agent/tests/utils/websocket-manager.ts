/**
 * WebSocket Manager for Seekapa BI Agent Testing
 * Handles WebSocket connections and message validation
 */

import { Page } from '@playwright/test';
import { WebSocketMessage } from '../types';

export class WebSocketManager {
  private page: Page;
  private wsMessages: WebSocketMessage[] = [];
  private wsConnected: boolean = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Establish WebSocket connection and set up message listeners
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        // Set up WebSocket message interception
        await this.page.route('**/ws/**', route => {
          route.continue();
        });

        // Monitor WebSocket connections
        this.page.on('websocket', ws => {
          console.log(`WebSocket connected: ${ws.url()}`);
          this.wsConnected = true;

          ws.on('framesent', event => {
            try {
              const message: WebSocketMessage = {
                type: 'user_message',
                content: event.payload,
                timestamp: Date.now()
              };
              this.wsMessages.push(message);
              console.log('WebSocket sent:', message);
            } catch (e) {
              console.log('WebSocket sent (non-JSON):', event.payload);
            }
          });

          ws.on('framereceived', event => {
            try {
              const data = JSON.parse(event.payload);
              const message: WebSocketMessage = {
                type: data.type || 'assistant_response',
                content: data.content || event.payload,
                timestamp: Date.now(),
                metadata: {
                  model: data.model,
                  tokenCount: data.tokenCount,
                  responseTime: data.responseTime
                }
              };
              this.wsMessages.push(message);
              console.log('WebSocket received:', message);
            } catch (e) {
              const message: WebSocketMessage = {
                type: 'assistant_response',
                content: event.payload,
                timestamp: Date.now()
              };
              this.wsMessages.push(message);
              console.log('WebSocket received (non-JSON):', event.payload);
            }
          });

          ws.on('close', () => {
            console.log('WebSocket disconnected');
            this.wsConnected = false;
          });
        });

        // Navigate to the application and wait for WebSocket
        await this.page.goto('/');
        await this.page.waitForLoadState('networkidle');

        // Wait for WebSocket connection indicator
        await this.page.waitForSelector('.text-copilot-text-muted', {
          timeout: 10000,
          state: 'visible'
        }).catch(() => {
          // If no status indicator, check for chat interface
          return this.page.waitForSelector('textarea[placeholder*="DS-Axia"]', {
            timeout: 10000
          });
        });

        // Give WebSocket time to establish
        await this.page.waitForTimeout(2000);

        if (!this.wsConnected) {
          // Try to trigger WebSocket connection by interacting with chat
          const chatInput = this.page.locator('[data-testid="chat-input"]').first();
          if (await chatInput.isVisible()) {
            await chatInput.click();
            await this.page.waitForTimeout(1000);
          }
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Send a message through the WebSocket (via UI)
   */
  async sendMessage(message: string): Promise<void> {
    const chatInput = this.page.locator('[data-testid="chat-input"]').first();
    await chatInput.fill(message);

    const sendButton = this.page.locator('[data-testid="send-button"]').first();
    await sendButton.click();
  }

  /**
   * Wait for a response message matching criteria
   */
  async waitForResponse(timeout: number = 30000): Promise<WebSocketMessage | null> {
    const startTime = Date.now();
    const initialMessageCount = this.wsMessages.length;

    while (Date.now() - startTime < timeout) {
      // Check for new assistant responses
      const newMessages = this.wsMessages.slice(initialMessageCount);
      const response = newMessages.find(msg =>
        msg.type === 'assistant_response' &&
        msg.content &&
        msg.content.length > 0
      );

      if (response) {
        return response;
      }

      await this.page.waitForTimeout(100);
    }

    return null;
  }

  /**
   * Get all WebSocket messages
   */
  getMessages(): WebSocketMessage[] {
    return [...this.wsMessages];
  }

  /**
   * Get the latest assistant response
   */
  getLatestResponse(): WebSocketMessage | null {
    const responses = this.wsMessages.filter(msg => msg.type === 'assistant_response');
    return responses.length > 0 ? responses[responses.length - 1] : null;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.wsConnected;
  }

  /**
   * Clear message history
   */
  clearMessages(): void {
    this.wsMessages = [];
  }

  /**
   * Get performance metrics from messages
   */
  getPerformanceMetrics(): {
    averageResponseTime: number;
    totalMessages: number;
    modelsUsed: string[];
  } {
    const responses = this.wsMessages.filter(msg =>
      msg.type === 'assistant_response' && msg.metadata?.responseTime
    );

    const responseTimes = responses
      .map(msg => msg.metadata?.responseTime)
      .filter(time => time !== undefined) as number[];

    const modelsUsed = responses
      .map(msg => msg.metadata?.model)
      .filter(model => model !== undefined) as string[];

    return {
      averageResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0,
      totalMessages: responses.length,
      modelsUsed: [...new Set(modelsUsed)]
    };
  }

  /**
   * Validate message content for CEO requirements
   */
  validateResponseQuality(message: WebSocketMessage): {
    isExecutiveLevel: boolean;
    hasBusinessMetrics: boolean;
    isProfessional: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const content = message.content.toLowerCase();

    // Check for executive-level language
    const executiveKeywords = ['revenue', 'profit', 'growth', 'performance', 'kpi', 'metric', 'trend', 'forecast'];
    const hasExecutiveKeywords = executiveKeywords.some(keyword => content.includes(keyword));

    // Check for business metrics
    const metricPatterns = [/\$[\d,]+/, /\d+%/, /\d+\.?\d*[kmb]?/i];
    const hasMetrics = metricPatterns.some(pattern => pattern.test(message.content));

    // Check for professional tone
    const unprofessionalWords = ['awesome', 'cool', 'hey', 'dude', 'guys'];
    const isProfessional = !unprofessionalWords.some(word => content.includes(word));

    if (!hasExecutiveKeywords) issues.push('Missing executive-level terminology');
    if (!hasMetrics) issues.push('No quantitative business metrics found');
    if (!isProfessional) issues.push('Unprofessional language detected');

    return {
      isExecutiveLevel: hasExecutiveKeywords,
      hasBusinessMetrics: hasMetrics,
      isProfessional: isProfessional,
      issues
    };
  }
}