/**
 * Multi-page website crawling engine with Playwright browser session reuse.
 */

import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';

import { ScannerError, describeCause, isScannerError } from './errors.js';
import { extractPageLinks } from './links.js';
import { scanPage } from './scanner.js';
import type {
  CrawlOptions,
  CrawlPageResult,
  CrawlResult,
  ScanOptions,
} from './types.js';
import { validateTargetUrl } from './url.js';

const DEFAULT_MAX_PAGES = 10;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;

interface QueueItem {
  readonly url: string;
  readonly depth: number;
}

/**
 * Crawls and audits multiple pages starting from a seed URL.
 *
 * Reuses a single Chromium browser instance for efficiency and closes
 * resources deterministically on any failure.
 */
export async function crawlSite(
  seedUrl: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const target = validateTargetUrl(seedUrl);
  const baseOrigin = target.origin;

  const maxPages = Math.max(1, options.maxPages ?? DEFAULT_MAX_PAGES);
  const maxDepth = Math.max(0, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const sameOriginOnly = options.sameOriginOnly ?? true;
  const timeoutMs =
    options.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;

  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (cause) {
    throw new ScannerError(
      'BROWSER_LAUNCH_FAILED',
      `Could not launch Chromium for crawl: ${describeCause(cause)}`,
      { cause },
    );
  }

  let context: BrowserContext | undefined;
  const visited = new Set<string>();
  const queue: QueueItem[] = [{ url: target.href, depth: 0 }];
  visited.add(target.href);

  const scannedPages: CrawlPageResult[] = [];

  try {
    context = await browser.newContext();

    while (queue.length > 0 && scannedPages.length < maxPages) {
      const current = queue.shift();
      if (!current) break;

      const page = await context.newPage();
      let pageResult: CrawlPageResult;

      try {
        const scanOptions: ScanOptions = {
          navigationTimeoutMs: timeoutMs,
          ...(options.axeRunOptions !== undefined
            ? { axeRunOptions: options.axeRunOptions }
            : {}),
        };

        const scanResult = await scanPage(
          page,
          current.url,
          current.url,
          scanOptions,
        );

        pageResult = {
          url: current.url,
          depth: current.depth,
          scanResult,
        };

        // If depth permits, discover more links on this page
        if (
          current.depth < maxDepth &&
          scannedPages.length + queue.length < maxPages * 3
        ) {
          const discoveredLinks = await extractPageLinks(
            page,
            current.url,
            baseOrigin,
            { sameOriginOnly },
          );

          for (const link of discoveredLinks) {
            if (!visited.has(link)) {
              visited.add(link);
              options.onPageDiscovered?.(link, current.depth + 1);
              queue.push({ url: link, depth: current.depth + 1 });
            }
          }
        }
      } catch (cause) {
        const errorMessage = isScannerError(cause)
          ? cause.message
          : describeCause(cause);

        pageResult = {
          url: current.url,
          depth: current.depth,
          error: errorMessage,
        };
      } finally {
        await page.close().catch(() => undefined);
      }

      scannedPages.push(pageResult);
      options.onPageScanned?.(pageResult);
    }
  } finally {
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  return {
    seedUrl: target.href,
    pages: scannedPages,
    durationMs: Date.now() - startedAt,
    startedAt: startedAtIso,
    completedAt: new Date().toISOString(),
  };
}
