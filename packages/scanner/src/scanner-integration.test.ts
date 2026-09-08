import { createServer } from 'node:http';

import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scanPage } from './scanner.js';

describe('scanner integration & edge cases', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 120_000);

  afterAll(async () => {
    await browser.close();
  });

  it('tracks redirect chains preserving requestedUrl vs finalUrl', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/redirect-start') {
        res.writeHead(302, { Location: '/redirect-destination' });
        res.end();
        return;
      }
      if (req.url === '/redirect-destination') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<!doctype html><html lang="en"><head><title>Destination</title></head><body><h1>Arrived</h1></body></html>',
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    const port =
      typeof address === 'object' && address !== null ? address.port : 0;
    const startUrl = `http://127.0.0.1:${port}/redirect-start`;
    const destinationUrl = `http://127.0.0.1:${port}/redirect-destination`;

    try {
      const result = await scanPage(page, startUrl, startUrl);

      expect(result.requestedUrl).toBe(startUrl);
      expect(result.finalUrl).toBe(destinationUrl);
      expect(result.title).toBe('Destination');
      expect(Array.isArray(result.axe.violations)).toBe(true);
    } finally {
      server.close();
    }
  }, 60_000);

  it('handles pages with unicode, emoji, and special characters in title', async () => {
    const unicodeTitle = '🌟 A11yFix 测试 & Başlık <special> ♿';
    await page.route('https://example.com/unicode', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><html lang="en"><head><title>${unicodeTitle}</title></head><body><h1>Unicode test</h1></body></html>`,
      });
    });

    const result = await scanPage(
      page,
      'https://example.com/unicode',
      'https://example.com/unicode',
    );

    expect(result.title).toBe(unicodeTitle);
  }, 60_000);

  it('handles pages without title or with empty title', async () => {
    await page.route('https://example.com/empty-title', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><head></head><body><main><h1>No title tag</h1></main></body></html>',
      });
    });

    const result = await scanPage(
      page,
      'https://example.com/empty-title',
      'https://example.com/empty-title',
    );

    expect(result.title).toBe('');
    expect(result.axe.violations.some((v) => v.id === 'document-title')).toBe(
      true,
    );
  }, 60_000);

  it('succeeds when subresources (images, stylesheets, scripts) fail to load', async () => {
    await page.route(
      'https://example.com/subresource-failure',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<!doctype html>
<html lang="en">
  <head>
    <title>Subresource Failure Test</title>
    <link rel="stylesheet" href="https://example.com/missing.css">
    <script src="https://example.com/missing.js"></script>
  </head>
  <body>
    <h1>Page loaded despite asset errors</h1>
    <img src="https://example.com/missing.png" alt="Accessible alt for broken image">
  </body>
</html>`,
        });
      },
    );

    await page.route('https://example.com/missing.css', async (route) => {
      await route.abort('failed');
    });
    await page.route('https://example.com/missing.js', async (route) => {
      await route.fulfill({ status: 404 });
    });
    await page.route('https://example.com/missing.png', async (route) => {
      await route.abort('failed');
    });

    const result = await scanPage(
      page,
      'https://example.com/subresource-failure',
      'https://example.com/subresource-failure',
    );

    expect(result.title).toBe('Subresource Failure Test');
    // Broken image has alt, so image-alt should not be a violation
    expect(result.axe.violations.some((v) => v.id === 'image-alt')).toBe(false);
  }, 60_000);

  it('audits complex DOM with SVG and nested structures', async () => {
    await page.route('https://example.com/complex-dom', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html>
<html lang="en">
  <head><title>Complex DOM</title></head>
  <body>
    <header role="banner">
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="/home">Home</a></li>
        </ul>
      </nav>
    </header>
    <main>
      <section>
        <h2>Vector Graphics</h2>
        <svg width="100" height="100" role="img" aria-label="A red circle">
          <circle cx="50" cy="50" r="40" fill="red" />
        </svg>
      </section>
      <section>
        <h2>Inaccessible Button</h2>
        <button id="empty-btn"></button>
      </section>
    </main>
  </body>
</html>`,
      });
    });

    const result = await scanPage(
      page,
      'https://example.com/complex-dom',
      'https://example.com/complex-dom',
    );

    expect(result.title).toBe('Complex DOM');
    expect(result.axe.violations.some((v) => v.id === 'button-name')).toBe(
      true,
    );
  }, 60_000);

  it('filters audit rules using axeRunOptions', async () => {
    await page.route('https://example.com/filtered-audit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html>
<html>
  <head></head>
  <body>
    <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
    <button></button>
  </body>
</html>`,
      });
    });

    const result = await scanPage(
      page,
      'https://example.com/filtered-audit',
      'https://example.com/filtered-audit',
      {
        axeRunOptions: {
          runOnly: { type: 'rule', values: ['button-name'] },
        },
      },
    );

    const checkedRuleIds = [
      ...result.axe.violations.map((r) => r.id),
      ...result.axe.passes.map((r) => r.id),
      ...result.axe.incomplete.map((r) => r.id),
      ...result.axe.inapplicable.map((r) => r.id),
    ];

    expect(checkedRuleIds).toEqual(['button-name']);
    expect(result.axe.violations.some((v) => v.id === 'button-name')).toBe(
      true,
    );
    expect(result.axe.violations.some((v) => v.id === 'image-alt')).toBe(false);
  }, 60_000);
});
