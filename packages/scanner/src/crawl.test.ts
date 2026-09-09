import { chromium } from 'playwright';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { crawlSite } from './crawl.js';
import * as linksModule from './links.js';
import * as scannerModule from './scanner.js';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
  },
}));

describe('crawlSite', () => {
  let mockPage: {
    close: ReturnType<typeof vi.fn>;
    url: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    newPage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let mockBrowser: {
    newContext: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  let launchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockPage = {
      close: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://example.com'),
    };

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    };

    launchSpy = vi
      .spyOn(chromium, 'launch')
      .mockResolvedValue(mockBrowser as never);
  });

  it('rejects invalid or private seed URLs before launching browser', async () => {
    await expect(crawlSite('not-a-url')).rejects.toThrow();
    await expect(crawlSite('http://localhost:3000')).rejects.toThrow();
    expect(launchSpy).not.toHaveBeenCalled();
  });

  it('crawls seed URL and stops when no more links are found', async () => {
    const mockScanResult = {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com',
      title: 'Example Home',
      scannedAt: new Date().toISOString(),
      durationMs: 100,
      axe: { violations: [] },
    };

    vi.spyOn(scannerModule, 'scanPage').mockResolvedValue(
      mockScanResult as never,
    );
    vi.spyOn(linksModule, 'extractPageLinks').mockResolvedValue([]);

    const result = await crawlSite('https://example.com');

    expect(result.seedUrl).toBe('https://example.com/');
    expect(result.pages.length).toBe(1);
    expect(result.pages[0]?.url).toBe('https://example.com/');
    expect(result.pages[0]?.depth).toBe(0);
    expect(result.pages[0]?.scanResult).toBe(mockScanResult);
    expect(mockBrowser.close.mock.calls.length).toBeGreaterThan(0);
  });

  it('traverses discovered links respecting maxPages and maxDepth', async () => {
    vi.spyOn(scannerModule, 'scanPage').mockImplementation((_p, reqUrl) =>
      Promise.resolve({
        requestedUrl: reqUrl,
        finalUrl: reqUrl,
        title: reqUrl,
        scannedAt: new Date().toISOString(),
        durationMs: 50,
        axe: { violations: [] },
      } as never),
    );

    vi.spyOn(linksModule, 'extractPageLinks').mockImplementation(
      (_p, currentUrl) => {
        if (currentUrl === 'https://example.com/') {
          return Promise.resolve([
            'https://example.com/a',
            'https://example.com/b',
          ]);
        }
        if (currentUrl === 'https://example.com/a') {
          return Promise.resolve(['https://example.com/c']);
        }
        return Promise.resolve([]);
      },
    );

    const discovered: string[] = [];
    const scanned: string[] = [];

    const result = await crawlSite('https://example.com', {
      maxPages: 3,
      maxDepth: 2,
      onPageDiscovered: (url) => discovered.push(url),
      onPageScanned: (p) => scanned.push(p.url),
    });

    expect(result.pages.length).toBe(3);
    expect(scanned).toEqual([
      'https://example.com/',
      'https://example.com/a',
      'https://example.com/b',
    ]);
    expect(discovered).toContain('https://example.com/a');
    expect(discovered).toContain('https://example.com/b');
  });

  it('isolates single page failure and continues crawling other pages', async () => {
    vi.spyOn(scannerModule, 'scanPage').mockImplementation((_p, reqUrl) => {
      if (reqUrl === 'https://example.com/error') {
        return Promise.reject(new Error('404 Not Found'));
      }
      return Promise.resolve({
        requestedUrl: reqUrl,
        finalUrl: reqUrl,
        title: reqUrl,
        scannedAt: new Date().toISOString(),
        durationMs: 50,
        axe: { violations: [] },
      } as never);
    });

    vi.spyOn(linksModule, 'extractPageLinks').mockResolvedValue([
      'https://example.com/error',
      'https://example.com/success',
    ]);

    const result = await crawlSite('https://example.com', { maxPages: 3 });

    expect(result.pages.length).toBe(3);
    const errorPage = result.pages.find(
      (p) => p.url === 'https://example.com/error',
    );
    expect(errorPage).toBeDefined();
    expect(errorPage?.error).toContain('404 Not Found');
    expect(errorPage?.scanResult).toBeUndefined();

    const successPage = result.pages.find(
      (p) => p.url === 'https://example.com/success',
    );
    expect(successPage?.scanResult).toBeDefined();
    expect(successPage?.error).toBeUndefined();
  });
});
