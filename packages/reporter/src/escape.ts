/**
 * HTML escaping utilities for secure report generation.
 *
 * All user-controlled and untrusted input (page titles, URLs, target
 * selectors, HTML snippets, failure summaries) must be escaped before
 * insertion into HTML documents to prevent Cross-Site Scripting (XSS).
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escapes characters with special meaning in HTML content.
 * Returns an empty string for null or undefined.
 */
export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return value.replace(
    HTML_ESCAPE_REGEX,
    (match) => HTML_ESCAPE_MAP[match] ?? match,
  );
}

/**
 * Escapes characters for safe inclusion in HTML attributes.
 */
export function escapeAttribute(value: string | null | undefined): string {
  return escapeHtml(value);
}

/**
 * Validates whether a URL uses a safe protocol (http/https) to prevent javascript: XSS.
 */
export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return /^https?:\/\//i.test(url.trim());
}
