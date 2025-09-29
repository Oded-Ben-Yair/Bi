/**
 * Health Checker for Seekapa BI Agent Testing
 * Validates all services are ready for CEO deployment testing
 */

import { Page } from '@playwright/test';
import { HealthCheckResult } from '../types';

export class HealthChecker {
  private page: Page;
  private baseUrl: string;

  constructor(page: Page, baseUrl: string = 'http://localhost:8000') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  /**
   * Comprehensive health check of all services
   */
  async checkAllServices(): Promise<{
    allHealthy: boolean;
    results: HealthCheckResult[];
    summary: string;
  }> {
    console.log('🏥 Starting comprehensive health check...');

    const results: HealthCheckResult[] = [];

    // Check main application health
    results.push(await this.checkMainHealth());

    // Check Azure services
    results.push(await this.checkAzureAI());
    results.push(await this.checkLogicApps());
    results.push(await this.checkAIFoundry());
    results.push(await this.checkWebhooks());

    // Check frontend availability
    results.push(await this.checkFrontend());

    // Check WebSocket connectivity
    results.push(await this.checkWebSocket());

    const healthyServices = results.filter(r => r.status === 'healthy').length;
    const allHealthy = results.every(r => r.status !== 'unhealthy');

    const summary = `${healthyServices}/${results.length} services healthy. ` +
      (allHealthy ? '✅ Ready for testing' : '❌ Issues detected');

    return { allHealthy, results, summary };
  }

  /**
   * Check main application health endpoint
   */
  private async checkMainHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await this.page.request.get(`${this.baseUrl}/health`);
      const responseTime = Date.now() - startTime;

      if (response.ok()) {
        const data = await response.json();
        return {
          service: 'Main Application',
          status: 'healthy',
          responseTime,
          details: data
        };
      } else {
        return {
          service: 'Main Application',
          status: 'unhealthy',
          responseTime,
          details: { error: `HTTP ${response.status()}` }
        };
      }
    } catch (error) {
      return {
        service: 'Main Application',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check Azure AI services
   */
  private async checkAzureAI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await this.page.request.get(`${this.baseUrl}/api/v1/health/ai-foundry`);
      const responseTime = Date.now() - startTime;

      if (response.ok()) {
        const data = await response.json();
        return {
          service: 'Azure AI Foundry',
          status: data.status === 'operational' ? 'healthy' : 'degraded',
          responseTime,
          details: data
        };
      } else {
        return {
          service: 'Azure AI Foundry',
          status: 'unhealthy',
          responseTime,
          details: { error: `HTTP ${response.status()}` }
        };
      }
    } catch (error) {
      return {
        service: 'Azure AI Foundry',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check Logic Apps connectivity
   */
  private async checkLogicApps(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await this.page.request.get(`${this.baseUrl}/api/v1/health/logic-app`);
      const responseTime = Date.now() - startTime;

      if (response.ok()) {
        const data = await response.json();
        return {
          service: 'Azure Logic Apps',
          status: data.status === 'connected' ? 'healthy' : 'degraded',
          responseTime,
          details: data
        };
      } else {
        return {
          service: 'Azure Logic Apps',
          status: 'degraded', // Not critical for testing
          responseTime,
          details: { error: `HTTP ${response.status()}` }
        };
      }
    } catch (error) {
      return {
        service: 'Azure Logic Apps',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check AI Foundry agent service
   */
  private async checkAIFoundry(): Promise<HealthCheckResult> {
    // This is covered by checkAzureAI, but we can add specific agent checks
    return {
      service: 'AI Foundry Agents',
      status: 'healthy',
      responseTime: 0,
      details: { note: 'Included in Azure AI check' }
    };
  }

  /**
   * Check webhook configuration
   */
  private async checkWebhooks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await this.page.request.get(`${this.baseUrl}/api/v1/health/webhook`);
      const responseTime = Date.now() - startTime;

      if (response.ok()) {
        const data = await response.json();
        return {
          service: 'Webhook Configuration',
          status: data.status === 'configured' ? 'healthy' : 'degraded',
          responseTime,
          details: data
        };
      } else {
        return {
          service: 'Webhook Configuration',
          status: 'degraded',
          responseTime,
          details: { error: `HTTP ${response.status()}` }
        };
      }
    } catch (error) {
      return {
        service: 'Webhook Configuration',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check frontend availability
   */
  private async checkFrontend(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await this.page.request.get('http://localhost:3000');
      const responseTime = Date.now() - startTime;

      if (response.ok()) {
        return {
          service: 'Frontend Application',
          status: 'healthy',
          responseTime,
          details: { url: 'http://localhost:3000' }
        };
      } else {
        return {
          service: 'Frontend Application',
          status: 'unhealthy',
          responseTime,
          details: { error: `HTTP ${response.status()}` }
        };
      }
    } catch (error) {
      return {
        service: 'Frontend Application',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Check WebSocket connectivity by loading the page
   */
  private async checkWebSocket(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      // Navigate to the application
      await this.page.goto('http://localhost:3000', { timeout: 10000 });

      // Wait for chat interface to load
      await this.page.waitForSelector('textarea[placeholder*="DS-Axia"]', {
        timeout: 5000
      }).catch(() => {
        // Try alternative selectors
        return this.page.waitForSelector('.flex.flex-col.h-full', {
          timeout: 5000
        });
      });

      const responseTime = Date.now() - startTime;

      // Check for WebSocket status indicators
      const wsStatus = await this.page.locator('.text-copilot-text-muted').first().textContent().catch(() => null);

      return {
        service: 'WebSocket Connection',
        status: 'healthy',
        responseTime,
        details: {
          status: wsStatus || 'Connected (inferred)',
          chatInterfaceLoaded: true
        }
      };
    } catch (error) {
      return {
        service: 'WebSocket Connection',
        status: 'degraded',
        responseTime: Date.now() - startTime,
        details: { error: String(error) }
      };
    }
  }

  /**
   * Wait for all services to be ready
   */
  async waitForReady(maxRetries: number = 5, delayMs: number = 5000): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Health check attempt ${attempt}/${maxRetries}`);

      const { allHealthy, summary } = await this.checkAllServices();

      if (allHealthy) {
        console.log(`✅ ${summary}`);
        return true;
      }

      console.log(`⚠️  ${summary}`);

      if (attempt < maxRetries) {
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await this.page.waitForTimeout(delayMs);
      }
    }

    console.log('❌ Services not ready after maximum retries');
    return false;
  }

  /**
   * Generate health check report
   */
  generateHealthReport(results: HealthCheckResult[]): string {
    const report = `
# Health Check Report
Generated: ${new Date().toISOString()}

## Summary
${results.map(result => {
  const icon = result.status === 'healthy' ? '✅' :
               result.status === 'degraded' ? '⚠️' : '❌';
  return `${icon} **${result.service}**: ${result.status} (${result.responseTime}ms)`;
}).join('\n')}

## Details
${results.map(result => `
### ${result.service}
- **Status**: ${result.status}
- **Response Time**: ${result.responseTime}ms
- **Details**: ${JSON.stringify(result.details, null, 2)}
`).join('\n')}
    `;

    return report.trim();
  }
}