import type { Page } from 'playwright';
import { describe, expect, it, vi } from 'vitest';

import { canonicalizeUrl, extractPageLinks } from './links.js';

describe('canonicalizeUrl', () => {
  const base = 'https://example.com/docs/intro';

  it('resolves relative URLs against the base URL', () => {
    expect(canonicalizeUrl('guide', base)).toBe(
      'https://example.com/docs/guide',
    );
    expect(canonicalizeUrl('/about', base)).toBe('https://example.com/about');
    expect(canonicalizeUrl('./tutorial', base)).toBe(
      'https://example.com/docs/tutorial',
    );
  });

  it('strips hash fragments', () => {
    expect(canonicalizeUrl('guide#overview', base)).toBe(
      'https://example.com/docs/guide',
    );
    expect(canonicalizeUrl('#section', base)).toBe(null); // Pure hash skipped
  });

  it('normalizes trailing slashes on sub-paths', () => {
    expect(canonicalizeUrl('https://example.com/docs/', base)).toBe(
      'https://example.com/docs',
    );
    expect(canonicalizeUrl('https://example.com/', base)).toBe(
      'https://example.com/',
    );
  });

  it('rejects unsupported protocols', () => {
    expect(canonicalizeUrl('mailto:support@example.com', base)).toBe(null);
    expect(canonicalizeUrl('tel:+1234567890', base)).toBe(null);
    expect(canonicalizeUrl('javascript:void(0)', base)).toBe(null);
    expect(canonicalizeUrl('data:text/html,test', base)).toBe(null);
  });

  it('rejects private IPs, localhost, and embedded credentials', () => {
    expect(canonicalizeUrl('http://localhost:3000', base)).toBe(null);
    expect(canonicalizeUrl('http://127.0.0.1/test', base)).toBe(null);
    expect(canonicalizeUrl('https://user:pass@example.com', base)).toBe(null);
  });

  it('rejects empty or whitespace strings', () => {
    expect(canonicalizeUrl('', base)).toBe(null);
    expect(canonicalizeUrl('   ', base)).toBe(null);
  });
});

describe('extractPageLinks', () => {
  it('extracts unique valid same-origin links from page DOM', async () => {
    const mockPage = {
      $$eval: vi
        .fn()
        .mockResolvedValue([
          '/about',
          '/pricing',
          'https://external.com/blog',
          'mailto:info@example.com',
          '/about#team',
          '#top',
        ]),
    } as unknown as Page;

    const links = await extractPageLinks(
      mockPage,
      'https://example.com/home',
      'https://example.com',
      { sameOriginOnly: true },
    );

    expect(links).toEqual([
      'https://example.com/about',
      'https://example.com/pricing',
    ]);
  });

  it('allows cross-origin links when sameOriginOnly is false', async () => {
    const mockPage = {
      $$eval: vi.fn().mockResolvedValue(['/about', 'https://other.com/docs']),
    } as unknown as Page;

    const links = await extractPageLinks(
      mockPage,
      'https://example.com/home',
      'https://example.com',
      { sameOriginOnly: false },
    );

    expect(links).toEqual([
      'https://example.com/about',
      'https://other.com/docs',
    ]);
  });

  it('handles $$eval rejection gracefully returning empty array', async () => {
    const mockPage = {
      $$eval: vi.fn().mockRejectedValue(new Error('DOM detached')),
    } as unknown as Page;

    const links = await extractPageLinks(
      mockPage,
      'https://example.com/home',
      'https://example.com',
    );

    expect(links).toEqual([]);
  });
});
