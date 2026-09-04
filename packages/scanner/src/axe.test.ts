/**
 * Real Playwright + axe-core integration test.
 *
 * No network access: page content is supplied with `page.setContent()`, so the
 * fixtures are deterministic and the suite works offline and in CI.
 */

import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auditPage, runAxe } from './axe.js';
import { ScannerError } from './errors.js';

const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const INACCESSIBLE_HTML = `<!doctype html>
<html lang="en">
  <head><title>Inaccessible fixture</title></head>
  <body>
    <img id="logo" src="${TRANSPARENT_GIF}" />
  </body>
</html>`;

const ACCESSIBLE_HTML = `<!doctype html>
<html lang="en">
  <head><title>Accessible fixture</title></head>
  <body>
    <h1>Accessible fixture</h1>
    <img id="logo" alt="A11yFix logo" src="${TRANSPARENT_GIF}" />
  </body>
</html>`;

describe('axe execution in Chromium', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 120_000);

  afterAll(async () => {
    await browser.close();
  });

  it('reports the image-alt violation on inaccessible markup', async () => {
    await page.setContent(INACCESSIBLE_HTML);

    const results = await auditPage(page);

    expect(Array.isArray(results.violations)).toBe(true);

    const imageAlt = results.violations.find(
      (violation) => violation.id === 'image-alt',
    );
    expect(imageAlt).toBeDefined();
    expect(imageAlt?.nodes.length).toBeGreaterThan(0);
    expect(
      imageAlt?.nodes.some((node) => node.html.includes('id="logo"')),
    ).toBe(true);
  }, 60_000);

  it('reports no image-alt violation on accessible markup', async () => {
    await page.setContent(ACCESSIBLE_HTML);

    const results = await auditPage(page);

    expect(
      results.violations.some((violation) => violation.id === 'image-alt'),
    ).toBe(false);
    expect(results.passes.some((pass) => pass.id === 'image-alt')).toBe(true);
  }, 60_000);

  it('honours axe run options', async () => {
    await page.setContent(INACCESSIBLE_HTML);

    const results = await auditPage(page, {
      runOnly: { type: 'rule', values: ['image-alt'] },
    });

    const ruleIds = new Set([
      ...results.violations.map((result) => result.id),
      ...results.passes.map((result) => result.id),
      ...results.incomplete.map((result) => result.id),
      ...results.inapplicable.map((result) => result.id),
    ]);

    expect([...ruleIds]).toEqual(['image-alt']);
  }, 60_000);

  it('replaces a page-owned axe global with the bundled axe-core', async () => {
    await page.setContent(INACCESSIBLE_HTML);
    await page.evaluate(() => {
      const pageWindow = window as unknown as {
        axe: { run: () => Promise<{ violations: never[] }> };
      };
      pageWindow.axe = {
        run: () => Promise.resolve({ violations: [] }),
      };
    });

    const results = await auditPage(page, {
      runOnly: { type: 'rule', values: ['image-alt'] },
    });

    expect(
      results.violations.some((violation) => violation.id === 'image-alt'),
    ).toBe(true);
  }, 60_000);

  it('is safe to audit the same page twice', async () => {
    await page.setContent(ACCESSIBLE_HTML);

    await auditPage(page);
    const second = await auditPage(page);

    expect(
      second.violations.some((violation) => violation.id === 'image-alt'),
    ).toBe(false);
  }, 60_000);

  it('throws AXE_EXECUTION_FAILED when axe is missing from the page', async () => {
    const bare = await browser.newPage();
    try {
      await bare.setContent(ACCESSIBLE_HTML);

      await expect(runAxe(bare)).rejects.toBeInstanceOf(ScannerError);
      await expect(runAxe(bare)).rejects.toMatchObject({
        code: 'AXE_EXECUTION_FAILED',
      });
    } finally {
      await bare.close();
    }
  }, 60_000);
});
