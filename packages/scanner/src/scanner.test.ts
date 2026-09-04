/**
 * Orchestration tests.
 *
 * `scanAccessibility` rejection paths are checked without touching Chromium at
 * all — if validation ever moved after the launch, these tests would slow down
 * or fail rather than pass silently. The happy path and navigation failure are
 * covered against a real page whose requests are fulfilled by a Playwright
 * route handler, so no network access is required.
 */

import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ScannerError } from './errors.js';
import { scanAccessibility, scanPage } from './scanner.js';

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head><title>Scanner fixture</title></head>
  <body>
    <h1>Scanner fixture</h1>
    <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
  </body>
</html>`;

describe('scanAccessibility validation', () => {
  it.each([
    ['not a url', 'INVALID_URL'],
    ['file:///etc/passwd', 'UNSUPPORTED_PROTOCOL'],
    ['https://user:pass@example.com', 'INVALID_URL'],
    ['http://127.0.0.1', 'PRIVATE_TARGET'],
  ])('rejects %s before launching a browser', async (url, code) => {
    const started = Date.now();

    await expect(scanAccessibility(url)).rejects.toBeInstanceOf(ScannerError);
    await expect(scanAccessibility(url)).rejects.toMatchObject({ code });

    // A Chromium launch costs far more than this budget; staying under it
    // shows validation short-circuited the scan.
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

describe('scanPage', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  }, 120_000);

  afterAll(async () => {
    await browser.close();
  });

  it('returns raw axe results with scan metadata', async () => {
    const page = await browser.newPage();
    try {
      await page.route('**/*', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: FIXTURE_HTML,
        }),
      );

      const result = await scanPage(
        page,
        'https://example.com',
        'https://example.com',
      );

      expect(result.requestedUrl).toBe('https://example.com');
      expect(result.finalUrl).toContain('example.com');
      expect(result.title).toBe('Scanner fixture');
      expect(new Date(result.scannedAt).toISOString()).toBe(result.scannedAt);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.axe.violations)).toBe(true);
      expect(
        result.axe.violations.some((violation) => violation.id === 'image-alt'),
      ).toBe(true);
    } finally {
      await page.close();
    }
  }, 60_000);

  it('maps navigation failures to NAVIGATION_FAILED', async () => {
    const page = await browser.newPage();
    try {
      await page.route('**/*', (route) => route.abort('connectionrefused'));

      await expect(
        scanPage(page, 'https://example.com', 'https://example.com', {
          navigationTimeoutMs: 5_000,
        }),
      ).rejects.toMatchObject({
        name: 'ScannerError',
        code: 'NAVIGATION_FAILED',
      });
    } finally {
      await page.close();
    }
  }, 60_000);

  it('leaves the page usable after a navigation failure', async () => {
    const page = await browser.newPage();
    try {
      await page.route('**/*', (route) => route.abort('connectionrefused'));

      await expect(
        scanPage(page, 'https://example.com', 'https://example.com', {
          navigationTimeoutMs: 5_000,
        }),
      ).rejects.toBeInstanceOf(ScannerError);

      expect(page.isClosed()).toBe(false);
    } finally {
      await page.close();
    }
  }, 60_000);
});
