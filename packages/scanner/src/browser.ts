/**
 * Chromium lifecycle management.
 *
 * Ownership is scoped to a single callback: the browser, context and page are
 * created for one scan and torn down in `finally`, so nothing leaks when
 * navigation, injection or the audit throws. No module-level browser state and
 * no pooling — a pool only becomes worthwhile once the CLI scans many URLs.
 */

import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';

import { ScannerError, describeCause } from './errors.js';

export interface BrowserSessionOptions {
  /** Launch a visible browser. Headless by default. */
  headless?: boolean;
}

/**
 * Runs `use` against a fresh Chromium page and always disposes the browser.
 *
 * @throws {ScannerError} with code `BROWSER_LAUNCH_FAILED` when Chromium cannot
 * be started. Errors thrown by `use` propagate unchanged.
 */
export async function withChromiumPage<T>(
  use: (page: Page) => Promise<T>,
  options: BrowserSessionOptions = {},
): Promise<T> {
  const { headless = true } = options;

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless });
  } catch (cause) {
    throw new ScannerError(
      'BROWSER_LAUNCH_FAILED',
      `Could not launch Chromium: ${describeCause(cause)}. Run "pnpm exec playwright install chromium" if the browser is missing.`,
      { cause },
    );
  }

  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext();
    const page = await context.newPage();
    return await use(page);
  } finally {
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
