/**
 * Scan orchestration: URL -> Chromium -> axe-core -> raw typed result.
 *
 * Validation happens before any browser is launched, so a rejected target
 * never costs a Chromium start.
 */

import type { Page } from 'playwright';

import { auditPage } from './axe.js';
import { withChromiumPage } from './browser.js';
import { ScannerError, describeCause, isScannerError } from './errors.js';
import type { ScanOptions, ScanResult } from './types.js';
import { validateTargetUrl } from './url.js';

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

/**
 * Navigates and audits an already-created page.
 *
 * Exposed for tests and for callers that own their own Playwright page;
 * `scanAccessibility` is the supported entry point for scanning a URL.
 */
export async function scanPage(
  page: Page,
  requestedUrl: string,
  targetUrl: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const { navigationTimeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS, axeRunOptions } =
    options;
  const startedAt = Date.now();
  const scannedAt = new Date(startedAt).toISOString();

  try {
    // `networkidle` is avoided deliberately: long-lived connections on modern
    // sites can keep it from ever settling.
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: navigationTimeoutMs,
    });
  } catch (cause) {
    throw new ScannerError(
      'NAVIGATION_FAILED',
      `Could not load "${targetUrl}": ${describeCause(cause)}`,
      { cause },
    );
  }

  const axeResults = await auditPage(page, axeRunOptions);

  return {
    requestedUrl,
    finalUrl: page.url(),
    title: await page.title(),
    scannedAt,
    durationMs: Date.now() - startedAt,
    axe: axeResults,
  };
}

/**
 * Scans a public HTTP/HTTPS page and returns raw axe results with metadata.
 *
 * @throws {ScannerError} — `INVALID_URL`, `UNSUPPORTED_PROTOCOL` or
 * `PRIVATE_TARGET` for a rejected target; `BROWSER_LAUNCH_FAILED`,
 * `NAVIGATION_FAILED`, `AXE_INJECTION_FAILED` or `AXE_EXECUTION_FAILED` for a
 * failed scan; `SCAN_FAILED` for anything unexpected.
 */
export async function scanAccessibility(
  url: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const target = validateTargetUrl(url);

  try {
    return await withChromiumPage((page) =>
      scanPage(page, url, target.href, options),
    );
  } catch (cause) {
    if (isScannerError(cause)) {
      throw cause;
    }

    throw new ScannerError(
      'SCAN_FAILED',
      `Scan of "${url}" failed: ${describeCause(cause)}`,
      {
        cause,
      },
    );
  }
}
