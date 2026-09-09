/**
 * Link extraction and URL canonicalization for multi-page crawling.
 */

import type { Page } from 'playwright';

import { validateTargetUrl } from './url.js';

const VALID_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Resolves, strips fragments, and canonicalizes a raw href against a base URL.
 *
 * Returns null if the URL is malformed, uses an unsupported protocol (e.g. mailto:,
 * tel:, javascript:), points to a private network target, or contains credentials.
 */
export function canonicalizeUrl(
  rawHref: string,
  baseUrl: string,
): string | null {
  if (typeof rawHref !== 'string' || rawHref.trim() === '') {
    return null;
  }

  const trimmedHref = rawHref.trim();

  // Fast skip for non-web schemes
  if (
    trimmedHref.startsWith('#') ||
    trimmedHref.startsWith('javascript:') ||
    trimmedHref.startsWith('mailto:') ||
    trimmedHref.startsWith('tel:') ||
    trimmedHref.startsWith('data:')
  ) {
    return null;
  }

  try {
    const resolved = new URL(trimmedHref, baseUrl);

    if (!VALID_PROTOCOLS.has(resolved.protocol)) {
      return null;
    }

    // Strip hash fragment
    resolved.hash = '';

    // Validate using scanner's target validation (blocks credentials, private IPs, localhost)
    validateTargetUrl(resolved.href);

    // Normalize: remove trailing slash if path is more than root '/'
    if (resolved.pathname.length > 1 && resolved.pathname.endsWith('/')) {
      resolved.pathname = resolved.pathname.slice(0, -1);
    }

    return resolved.href;
  } catch {
    return null;
  }
}

export interface ExtractLinksOptions {
  /** Only keep links that share the exact origin (protocol + host + port). */
  readonly sameOriginOnly?: boolean | undefined;
}

/**
 * Extracts and canonicalizes all valid HTML anchor links from a page.
 *
 * @param page Playwright Page instance with loaded DOM.
 * @param currentUrl Current page URL to resolve relative paths against.
 * @param baseOrigin The origin of the crawl seed URL.
 * @param options Link filtering options.
 */
export async function extractPageLinks(
  page: Page,
  currentUrl: string,
  baseOrigin: string,
  options: ExtractLinksOptions = {},
): Promise<readonly string[]> {
  const { sameOriginOnly = true } = options;

  let rawHrefs: string[];
  try {
    rawHrefs = await page.$$eval('a[href]', (elements) =>
      elements
        .map((el) => el.getAttribute('href'))
        .filter((href): href is string => typeof href === 'string'),
    );
  } catch {
    return [];
  }

  const discovered = new Set<string>();

  for (const rawHref of rawHrefs) {
    const canonical = canonicalizeUrl(rawHref, currentUrl);
    if (canonical === null) {
      continue;
    }

    if (sameOriginOnly) {
      try {
        const linkOrigin = new URL(canonical).origin;
        if (linkOrigin !== baseOrigin) {
          continue;
        }
      } catch {
        continue;
      }
    }

    discovered.add(canonical);
  }

  return Array.from(discovered);
}
