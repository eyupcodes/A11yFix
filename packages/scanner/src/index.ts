/**
 * `@a11yfix/scanner` public API.
 *
 * The scanner is deliberately thin: it turns a URL into raw axe-core results
 * plus scan metadata. Normalization, WCAG mapping, severity and scoring belong
 * to `@a11yfix/core` (M3) and must not be added here.
 */

export { scanAccessibility, scanPage } from './scanner.js';
export { crawlSite } from './crawl.js';
export { canonicalizeUrl, extractPageLinks } from './links.js';
export type { ExtractLinksOptions } from './links.js';
export { auditPage } from './axe.js';
export { withChromiumPage } from './browser.js';
export { ScannerError, SCANNER_ERROR_CODES, isScannerError } from './errors.js';
export type { ScannerErrorCode } from './errors.js';
export type {
  ScanOptions,
  ScanResult,
  CrawlOptions,
  CrawlPageResult,
  CrawlResult,
  AxeResults,
  RunOptions,
} from './types.js';
