/**
 * axe-core execution against an already-navigated Playwright page.
 *
 * The bundled `axe.source` is injected into the page and `axe.run()` is
 * evaluated inside the browser context. Results are returned exactly as axe
 * produces them; no A11yFix-specific transformation happens here.
 */

import axe from 'axe-core';
import type { Page } from 'playwright';

import { ScannerError, describeCause } from './errors.js';
import type { AxeResults, RunOptions } from './types.js';

declare global {
  interface Window {
    axe?: typeof axe;
  }
}

export async function injectAxe(page: Page): Promise<void> {
  try {
    // Scanned content is untrusted. Always replace any page-owned `window.axe`
    // rather than allowing it to suppress or fabricate audit results.
    await page.evaluate(axe.source);

    const injected = await page.evaluate(
      () => typeof window.axe !== 'undefined',
    );
    if (!injected) {
      throw new Error('axe-core was not defined on the page after injection.');
    }
  } catch (cause) {
    throw new ScannerError(
      'AXE_INJECTION_FAILED',
      `Could not inject axe-core into the page: ${describeCause(cause)}`,
      { cause },
    );
  }
}

export async function runAxe(
  page: Page,
  runOptions?: RunOptions,
): Promise<AxeResults> {
  try {
    return await page.evaluate(async (options: RunOptions | undefined) => {
      const instance = window.axe;
      if (instance === undefined) {
        throw new Error('axe-core is not available on the page.');
      }

      return instance.run(document, options ?? {});
    }, runOptions);
  } catch (cause) {
    throw new ScannerError(
      'AXE_EXECUTION_FAILED',
      `axe-core failed while auditing the page: ${describeCause(cause)}`,
      { cause },
    );
  }
}

/** Injects axe-core and runs it in one step. */
export async function auditPage(
  page: Page,
  runOptions?: RunOptions,
): Promise<AxeResults> {
  await injectAxe(page);
  return runAxe(page, runOptions);
}
