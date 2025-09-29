/**
 * Security Tests for Seekapa BI Agent
 * Comprehensive security testing including authentication, authorization, and vulnerability checks
 */

import { test, expect, Page, Request } from '@playwright/test';

test.describe('Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to application
    await page.goto('/');
  });

  test.describe('Input Validation & XSS Protection', () => {
    test('Chat input - XSS script injection protection', async ({ page }) => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>',
        '\'-alert(String.fromCharCode(88,83,83))-\'',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<object data="javascript:alert(\'XSS\')"></object>'
      ];

      for (const maliciousInput of maliciousInputs) {
        // Input malicious script
        await page.locator('[data-testid="chat-input"]').fill(maliciousInput);
        await page.locator('[data-testid="send-button"]').click();

        // Wait for message to appear
        await expect(page.locator('[data-testid="message"]').last()).toBeVisible();

        // Verify script is not executed (no alert dialog)
        const dialogs: string[] = [];
        page.on('dialog', dialog => {
          dialogs.push(dialog.message());
          dialog.dismiss();
        });

        // Check that malicious content is escaped/sanitized
        const messageContent = await page.locator('[data-testid="message"]').last().textContent();
        expect(messageContent).not.toContain('<script>');
        expect(messageContent).not.toContain('javascript:');
        expect(messageContent).not.toContain('onerror=');
        expect(messageContent).not.toContain('onload=');

        // Verify no JavaScript execution occurred
        expect(dialogs).toHaveLength(0);
      }
    });

    test('URL parameter validation', async ({ page }) => {
      const maliciousUrls = [
        '/?param=<script>alert("XSS")</script>',
        '/?redirect=javascript:alert("XSS")',
        '/?callback=<img src=x onerror=alert("XSS")>',
        '/?search="><script>alert("XSS")</script>'
      ];

      for (const url of maliciousUrls) {
        await page.goto(url);

        // Verify page loads normally without executing scripts
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

        // Check for XSS in URL parameters
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('<script>');

        // Verify no alert dialogs
        let alertTriggered = false;
        page.on('dialog', () => {
          alertTriggered = true;
        });

        await page.waitForTimeout(1000);
        expect(alertTriggered).toBeFalsy();
      }
    });

    test('SQL injection in search parameters', async ({ page }) => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT password FROM users--",
        "'; EXEC xp_cmdshell('dir'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        // Try injecting in chat
        await page.locator('[data-testid="chat-input"]').fill(payload);
        await page.locator('[data-testid="send-button"]').click();

        // Verify application doesn't crash or reveal database errors
        await expect(page.locator('[data-testid="app-container"]')).toBeVisible();

        // Check for database error messages
        const pageContent = await page.textContent('body');
        expect(pageContent).not.toMatch(/SQL Server|MySQL|PostgreSQL|ORA-\d+|sqlite/i);
        expect(pageContent).not.toMatch(/syntax error|database error/i);
      }
    });
  });

  test.describe('Authentication & Authorization', () => {
    test('API endpoints require proper authentication', async ({ page }) => {
      const protectedEndpoints = [
        '/api/powerbi/axia/info',
        '/api/powerbi/axia/query',
        '/api/powerbi/axia/refresh',
        '/api/chat'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await page.request.get(endpoint);

        // Should not return 200 without proper auth
        // Expecting 401 (Unauthorized) or 403 (Forbidden)
        expect([401, 403, 422].includes(response.status())).toBeTruthy();
      }
    });

    test('WebSocket connection security', async ({ page }) => {
      // Monitor WebSocket connections
      const wsConnections: any[] = [];

      page.on('websocket', ws => {
        wsConnections.push({
          url: ws.url(),
          isClosed: ws.isClosed()
        });

        ws.on('close', () => {
          console.log('WebSocket closed');
        });
      });

      // Navigate and trigger WebSocket connection
      await page.goto('/');
      await page.waitForTimeout(2000);

      // Verify WebSocket uses secure connection in production
      if (page.url().startsWith('https://')) {
        wsConnections.forEach(ws => {
          expect(ws.url).toMatch(/^wss:/); // Secure WebSocket
        });
      }
    });

    test('Session management and timeouts', async ({ page, context }) => {
      // Test session persistence
      await page.goto('/');

      // Interact with chat
      await page.locator('[data-testid="chat-input"]').fill('Test session message');
      await page.locator('[data-testid="send-button"]').click();

      // Get cookies
      const cookies = await context.cookies();
      const sessionCookies = cookies.filter(cookie =>
        cookie.name.toLowerCase().includes('session') ||
        cookie.name.toLowerCase().includes('auth')
      );

      // Verify secure cookie settings
      sessionCookies.forEach(cookie => {
        // In production, should be secure and httpOnly
        if (page.url().startsWith('https://')) {
          expect(cookie.secure).toBeTruthy();
        }
        expect(cookie.httpOnly).toBeTruthy();
      });
    });
  });

  test.describe('Data Protection & Privacy', () => {
    test('Sensitive data exposure in DOM', async ({ page }) => {
      await page.goto('/');

      // Check for exposed sensitive data in DOM
      const pageContent = await page.content();

      // Should not contain API keys, passwords, or tokens
      expect(pageContent).not.toMatch(/api[_-]?key/i);
      expect(pageContent).not.toMatch(/password/i);
      expect(pageContent).not.toMatch(/secret/i);
      expect(pageContent).not.toMatch(/token/i);
      expect(pageContent).not.toMatch(/bearer\s+[a-zA-Z0-9]/i);

      // Check localStorage and sessionStorage
      const localStorageData = await page.evaluate(() => {
        const data: any = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data[key] = localStorage.getItem(key);
          }
        }
        return data;
      });

      // Verify no sensitive data in localStorage
      Object.entries(localStorageData).forEach(([key, value]) => {
        expect(key.toLowerCase()).not.toMatch(/password|secret|key|token/);
        if (typeof value === 'string') {
          expect(value).not.toMatch(/^sk-|^pk_|^bearer\s/i);
        }
      });
    });

    test('Network request security', async ({ page }) => {
      const requests: Request[] = [];

      page.on('request', request => {
        requests.push(request);
      });

      await page.goto('/');
      await page.locator('[data-testid="chat-input"]').fill('Test network security');
      await page.locator('[data-testid="send-button"]').click();

      await page.waitForTimeout(2000);

      // Analyze requests for security
      requests.forEach(request => {
        const url = request.url();
        const headers = request.headers();

        // Verify HTTPS in production
        if (process.env.NODE_ENV === 'production') {
          if (url.startsWith('http://') && !url.includes('localhost')) {
            expect(url).toMatch(/^https:/);
          }
        }

        // Check for sensitive data in URLs
        expect(url).not.toMatch(/password|secret|api[_-]?key/i);

        // Verify proper headers
        if (request.method() === 'POST') {
          expect(headers['content-type']).toBeDefined();
        }
      });
    });

    test('Error message information disclosure', async ({ page }) => {
      // Trigger various error conditions
      const errorScenarios = [
        {
          action: async () => {
            // Invalid API call
            await page.route('**/api/chat', route => {
              route.fulfill({
                status: 500,
                body: JSON.stringify({
                  error: 'Database connection failed: host=localhost user=admin password=secret123'
                })
              });
            });
          },
          description: 'Database error with credentials'
        },
        {
          action: async () => {
            // File path disclosure
            await page.route('**/api/**', route => {
              route.fulfill({
                status: 500,
                body: JSON.stringify({
                  error: 'File not found: /home/user/.env',
                  stack: 'Error at /app/src/services/config.js:25:10'
                })
              });
            });
          },
          description: 'File path disclosure'
        }
      ];

      for (const scenario of errorScenarios) {
        await scenario.action();

        await page.locator('[data-testid="chat-input"]').fill('Trigger error');
        await page.locator('[data-testid="send-button"]').click();

        await page.waitForTimeout(1000);

        // Check error messages don't expose sensitive information
        const errorElements = page.locator('[data-testid="error-message"]');
        if (await errorElements.count() > 0) {
          const errorText = await errorElements.first().textContent();

          // Should not contain sensitive paths or credentials
          expect(errorText).not.toMatch(/password|secret|api[_-]?key/i);
          expect(errorText).not.toMatch(/\/home\/|\/app\/|C:\\|D:\\/);
          expect(errorText).not.toMatch(/\.(env|config|key)$/);
        }
      }
    });
  });

  test.describe('Content Security Policy (CSP)', () => {
    test('CSP headers are properly configured', async ({ page }) => {
      const response = await page.goto('/');

      if (response) {
        const cspHeader = response.headers()['content-security-policy'];

        if (cspHeader) {
          // Basic CSP checks
          expect(cspHeader).toContain("default-src 'self'");
          expect(cspHeader).not.toContain("'unsafe-eval'");
          expect(cspHeader).not.toContain("'unsafe-inline'");

          // Should restrict object-src
          expect(cspHeader).toMatch(/object-src\s+'none'/);
        }
      }
    });

    test('Inline scripts are blocked by CSP', async ({ page }) => {
      // Inject inline script and verify it's blocked
      await page.addScriptTag({
        content: 'window.inlineScriptExecuted = true;'
      }).catch(() => {
        // Script should be blocked by CSP
      });

      const scriptExecuted = await page.evaluate(() => (window as any).inlineScriptExecuted);
      expect(scriptExecuted).toBeFalsy();
    });
  });

  test.describe('Cross-Origin Security', () => {
    test('CORS headers are properly configured', async ({ page }) => {
      // Make request and check CORS headers
      const response = await page.request.get('/api/health');

      const corsHeaders = {
        'access-control-allow-origin': response.headers()['access-control-allow-origin'],
        'access-control-allow-methods': response.headers()['access-control-allow-methods'],
        'access-control-allow-headers': response.headers()['access-control-allow-headers']
      };

      // Verify CORS is not overly permissive
      expect(corsHeaders['access-control-allow-origin']).not.toBe('*');

      if (corsHeaders['access-control-allow-origin']) {
        // Should be specific origins or localhost for development
        expect(corsHeaders['access-control-allow-origin']).toMatch(
          /^(https?:\/\/localhost|https?:\/\/[\w\.-]+\.[\w]+|null)$/
        );
      }
    });

    test('Referrer policy is configured', async ({ page }) => {
      const response = await page.goto('/');

      if (response) {
        const referrerPolicy = response.headers()['referrer-policy'];
        // Should have a restrictive referrer policy
        if (referrerPolicy) {
          expect(['no-referrer', 'same-origin', 'strict-origin-when-cross-origin'])
            .toContain(referrerPolicy);
        }
      }
    });
  });

  test.describe('Rate Limiting & DoS Protection', () => {
    test('API rate limiting is enforced', async ({ page }) => {
      const rapidRequests = [];

      // Send rapid requests
      for (let i = 0; i < 20; i++) {
        rapidRequests.push(
          page.request.post('/api/chat', {
            data: {
              message: `Rapid request ${i}`,
              conversation_id: 'rate-limit-test'
            }
          })
        );
      }

      const responses = await Promise.all(rapidRequests);

      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('Large payload handling', async ({ page }) => {
      // Create extremely large message
      const largeMessage = 'x'.repeat(1000000); // 1MB

      const response = await page.request.post('/api/chat', {
        data: {
          message: largeMessage,
          conversation_id: 'large-payload-test'
        }
      });

      // Should either process or reject with appropriate status
      expect([200, 413, 422].includes(response.status())).toBeTruthy();
    });
  });

  test.describe('Dependency & Third-Party Security', () => {
    test('No known vulnerable dependencies in client bundle', async ({ page }) => {
      await page.goto('/');

      // Check for known vulnerable libraries
      const vulnerablePatterns = [
        /jquery\s*[<>=]\s*[12]\./i, // Old jQuery versions
        /lodash\s*[<>=]\s*4\.[0-16]\./i, // Vulnerable Lodash versions
        /moment\s*[<>=]\s*2\.[0-28]\./i // Vulnerable Moment.js versions
      ];

      const pageContent = await page.content();

      vulnerablePatterns.forEach(pattern => {
        expect(pageContent).not.toMatch(pattern);
      });
    });

    test('External resource integrity', async ({ page }) => {
      await page.goto('/');

      // Check for external scripts without integrity hashes
      const externalScripts = await page.locator('script[src*="://"]').all();

      for (const script of externalScripts) {
        const src = await script.getAttribute('src');
        const integrity = await script.getAttribute('integrity');

        if (src && !src.includes('localhost')) {
          // External scripts should have integrity hashes
          expect(integrity).toBeTruthy();
          expect(integrity).toMatch(/^(sha256|sha384|sha512)-/);
        }
      }
    });
  });

  test.describe('Security Headers', () => {
    test('Security headers are present', async ({ page }) => {
      const response = await page.goto('/');

      if (response) {
        const headers = response.headers();

        // Check for important security headers
        expect(headers['x-frame-options'] || headers['X-Frame-Options']).toBeDefined();
        expect(headers['x-content-type-options'] || headers['X-Content-Type-Options']).toBe('nosniff');

        // Strict Transport Security for HTTPS
        if (page.url().startsWith('https://')) {
          expect(headers['strict-transport-security']).toBeDefined();
        }
      }
    });
  });
});