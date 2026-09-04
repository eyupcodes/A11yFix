/**
 * Public scanner types.
 *
 * Raw axe types are re-used directly rather than mirrored, so the scanner
 * never drifts from the axe-core result schema. Normalization, severity
 * handling and scoring belong to `@a11yfix/core` in M3 and must not leak here.
 */

import type { AxeResults, RunOptions } from 'axe-core';

export interface ScanOptions {
  /**
   * Maximum time to wait for navigation to reach `domcontentloaded`.
   *
   * @defaultValue 30000
   */
  navigationTimeoutMs?: number;

  /**
   * Options forwarded verbatim to `axe.run()` inside the page, e.g. to limit
   * the run to a tag set such as `{ runOnly: ['wcag2a', 'wcag2aa'] }`.
   */
  axeRunOptions?: RunOptions;
}

export interface ScanResult {
  /** The URL exactly as requested by the caller. */
  requestedUrl: string;
  /** The URL after any redirects, as reported by the page. */
  finalUrl: string;
  /** Document title of the scanned page; empty when the page has none. */
  title: string;
  /** ISO-8601 timestamp taken when the scan started. */
  scannedAt: string;
  /** Wall-clock duration of the whole scan, in milliseconds. */
  durationMs: number;
  /** Unmodified axe-core results. */
  axe: AxeResults;
}

export type { AxeResults, RunOptions };
