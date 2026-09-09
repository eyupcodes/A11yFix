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
  navigationTimeoutMs?: number | undefined;

  /**
   * Options forwarded verbatim to `axe.run()` inside the page, e.g. to limit
   * the run to a tag set such as `{ runOnly: ['wcag2a', 'wcag2aa'] }`.
   */
  axeRunOptions?: RunOptions | undefined;
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

/** Options configuring multi-page website crawling. */
export interface CrawlOptions {
  /**
   * Maximum number of pages to scan during the crawl.
   *
   * @defaultValue 10
   */
  readonly maxPages?: number | undefined;

  /**
   * Maximum depth from the seed URL (seed page is depth 0).
   *
   * @defaultValue 2
   */
  readonly maxDepth?: number | undefined;

  /**
   * Restrict crawled links to the same origin (protocol + hostname + port) as seed URL.
   *
   * @defaultValue true
   */
  readonly sameOriginOnly?: boolean | undefined;

  /**
   * Navigation timeout in milliseconds for each audited page.
   *
   * @defaultValue 30000
   */
  readonly navigationTimeoutMs?: number | undefined;

  /**
   * Options forwarded verbatim to `axe.run()` inside each page.
   */
  readonly axeRunOptions?: RunOptions | undefined;

  /**
   * Optional callback fired when a new link is discovered during crawl.
   */
  readonly onPageDiscovered?:
    ((url: string, depth: number) => void) | undefined;

  /**
   * Optional callback fired when a page audit completes (success or failure).
   */
  readonly onPageScanned?: ((page: CrawlPageResult) => void) | undefined;
}

/** The outcome of auditing an individual page during a crawl. */
export interface CrawlPageResult {
  /** The canonicalized URL of the page. */
  readonly url: string;
  /** Depth level in the crawl tree (seed is 0). */
  readonly depth: number;
  /** Successful scan result, or undefined if the page failed to load/audit. */
  readonly scanResult?: ScanResult | undefined;
  /** Error message if loading or auditing this page failed. */
  readonly error?: string | undefined;
}

/** Aggregated raw crawl results for an entire website. */
export interface CrawlResult {
  /** The starting seed URL. */
  readonly seedUrl: string;
  /** Chronologically ordered list of audited pages. */
  readonly pages: readonly CrawlPageResult[];
  /** Total wall-clock duration of the entire crawl in milliseconds. */
  readonly durationMs: number;
  /** ISO-8601 timestamp when crawl started. */
  readonly startedAt: string;
  /** ISO-8601 timestamp when crawl finished. */
  readonly completedAt: string;
}

export type { AxeResults, RunOptions };
