import { readFile } from 'node:fs/promises';

import type { MultiPageReport } from '@a11yfix/core';
import { analyzeCrawlResults } from '@a11yfix/core';
import { renderMultiPageJsonReport, writeReport } from '@a11yfix/reporter';
import { crawlSite, ScannerError } from '@a11yfix/scanner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeCrawl } from './crawl.js';
import type { CliIo } from './types.js';
import { EXIT_CODES } from './types.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn() };
});

vi.mock('@a11yfix/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/scanner')>();
  return { ...actual, crawlSite: vi.fn() };
});

vi.mock('@a11yfix/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/core')>();
  return { ...actual, analyzeCrawlResults: vi.fn() };
});

vi.mock('@a11yfix/reporter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/reporter')>();
  return {
    ...actual,
    writeReport: vi.fn(),
    renderMultiPageJsonReport: vi.fn(),
  };
});

function makeReport(
  overrides: Partial<MultiPageReport['summary']> = {},
): MultiPageReport {
  return {
    summary: {
      seedUrl: 'https://example.com/',
      totalPages: 2,
      successfulPages: 2,
      failedPages: 0,
      siteScore: 88,
      siteGrade: 'B',
      totalViolations: 3,
      totalPasses: 20,
      countsBySeverity: { critical: 0, serious: 1, moderate: 2, minor: 0 },
      durationMs: 500,
      scannedAt: '2026-09-08T12:00:00.000Z',
      ...overrides,
    },
    pages: [
      {
        url: 'https://example.com/',
        depth: 0,
        report: {
          score: 90,
          grade: 'A',
          findings: [],
          breakdown: {
            totalPenalty: 10,
            countsBySeverity: {
              critical: 0,
              serious: 0,
              moderate: 0,
              minor: 0,
            },
            scoredFindings: 0,
            bestPracticeFindings: 0,
          },
          ruleCounts: {
            violations: 0,
            passes: 10,
            incomplete: 0,
            inapplicable: 0,
          },
          meta: {
            requestedUrl: 'https://example.com/',
            finalUrl: 'https://example.com/',
            title: '',
            scannedAt: '',
          },
        } as never,
        error: null,
      },
      {
        url: 'https://example.com/about',
        depth: 1,
        report: {
          score: 86,
          grade: 'B',
          findings: [],
          breakdown: {
            totalPenalty: 14,
            countsBySeverity: {
              critical: 0,
              serious: 0,
              moderate: 0,
              minor: 0,
            },
            scoredFindings: 0,
            bestPracticeFindings: 0,
          },
          ruleCounts: {
            violations: 0,
            passes: 8,
            incomplete: 0,
            inapplicable: 0,
          },
          meta: {
            requestedUrl: 'https://example.com/about',
            finalUrl: 'https://example.com/about',
            title: '',
            scannedAt: '',
          },
        } as never,
        error: null,
      },
    ],
    commonViolations: [],
  };
}

describe('executeCrawl', () => {
  let stdoutLogs: string[];
  let stderrLogs: string[];
  let testIo: CliIo;
  const mockReport = makeReport();

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutLogs = [];
    stderrLogs = [];
    testIo = {
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    };

    vi.mocked(crawlSite).mockResolvedValue({
      seedUrl: 'https://example.com/',
      pages: [
        {
          url: 'https://example.com/',
          depth: 0,
          scanResult: { axe: { violations: [] } } as never,
        },
        {
          url: 'https://example.com/about',
          depth: 1,
          scanResult: { axe: { violations: [] } } as never,
        },
      ],
      durationMs: 500,
      startedAt: '2026-09-08T12:00:00.000Z',
      completedAt: '2026-09-08T12:00:00.500Z',
    });

    vi.mocked(analyzeCrawlResults).mockReturnValue(mockReport);
    vi.mocked(renderMultiPageJsonReport).mockReturnValue('{"siteScore":88}');
    vi.mocked(writeReport).mockResolvedValue(undefined);
  });

  it('runs crawl and returns SUCCESS with terminal summary', async () => {
    const code = await executeCrawl('https://example.com', {}, testIo);
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(crawlSite).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({}),
    );
    expect(analyzeCrawlResults).toHaveBeenCalled();
    expect(stdoutLogs.join('\n')).toContain(
      'A11yFix Site Accessibility Crawl Report',
    );
  });

  it('outputs JSON when --json flag is set', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { json: true },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(renderMultiPageJsonReport).toHaveBeenCalledWith(mockReport, {
      pretty: true,
    });
    expect(stdoutLogs).toContain('{"siteScore":88}');
  });

  it('suppresses summary when --quiet without --json', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { quiet: true },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(stdoutLogs).toHaveLength(0);
  });

  it('writes report to disk when output is specified', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { output: 'reports/crawl.html', format: 'html' },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(writeReport).toHaveBeenCalledWith(
      mockReport as never,
      'reports/crawl.html',
      { format: 'html' },
    );
  });

  it('writes SARIF report to disk when format is sarif', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { output: 'reports/site.sarif', format: 'sarif' },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(writeReport).toHaveBeenCalledWith(
      mockReport as never,
      'reports/site.sarif',
      { format: 'sarif' },
    );
  });

  it('returns SUCCESS when site score meets threshold', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { threshold: 80 },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(stdoutLogs.join('\n')).toContain('PASS');
  });

  it('returns FAILURE when site score below threshold', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { threshold: 95 },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.FAILURE);
    expect(stdoutLogs.join('\n')).toContain('FAIL');
  });

  it('validates threshold and returns INVALID_ARGS', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { threshold: 150 },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_THRESHOLD');
    expect(crawlSite).not.toHaveBeenCalled();
  });

  it('validates maxPages and returns INVALID_ARGS', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { maxPages: 0 },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_MAX_PAGES');
    expect(crawlSite).not.toHaveBeenCalled();
  });

  it('validates maxDepth and returns INVALID_ARGS', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { maxDepth: -1 },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_MAX_DEPTH');
    expect(crawlSite).not.toHaveBeenCalled();
  });

  it('validates format and returns INVALID_ARGS', async () => {
    const code = await executeCrawl(
      'https://example.com',
      { format: 'csv' as never },
      testIo,
    );
    expect(code).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_FORMAT');
    expect(crawlSite).not.toHaveBeenCalled();
  });

  it('returns INVALID_ARGS when scanner throws INVALID_URL', async () => {
    vi.mocked(crawlSite).mockRejectedValue(
      new ScannerError('INVALID_URL', 'bad url'),
    );
    const code = await executeCrawl('bad', {}, testIo);
    expect(code).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_URL');
  });

  it('returns FAILURE on general crawl failure', async () => {
    vi.mocked(crawlSite).mockRejectedValue(
      new ScannerError('NAVIGATION_FAILED', 'timeout'),
    );
    const code = await executeCrawl('https://example.com', {}, testIo);
    expect(code).toBe(EXIT_CODES.FAILURE);
    expect(stderrLogs.join('\n')).toContain('NAVIGATION_FAILED');
  });

  describe('crawl baseline regression tracking', () => {
    it('returns INVALID_ARGS when --fail-on-regression is used without --baseline', async () => {
      const code = await executeCrawl(
        'https://example.com',
        { failOnRegression: true },
        testIo,
      );
      expect(code).toBe(EXIT_CODES.INVALID_ARGS);
      expect(stderrLogs.join('\n')).toContain(
        '--fail-on-regression requires a baseline report',
      );
    });

    it('returns INVALID_ARGS when baseline file fails to read', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
      const code = await executeCrawl(
        'https://example.com',
        { baseline: 'missing.json' },
        testIo,
      );
      expect(code).toBe(EXIT_CODES.INVALID_ARGS);
      expect(stderrLogs.join('\n')).toContain('INVALID_BASELINE');
    });

    it('outputs multi-page diff and succeeds when crawl matches baseline', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockReport));
      const code = await executeCrawl(
        'https://example.com',
        { baseline: 'baseline.json' },
        testIo,
      );
      expect(code).toBe(EXIT_CODES.SUCCESS);
      expect(stdoutLogs.join('\n')).toContain(
        'A11yFix Accessibility Regression Diff Report',
      );
      expect(stdoutLogs.join('\n')).toContain('Pages Audited:');
    });

    it('outputs diff json when --json is passed with baseline', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockReport));
      const code = await executeCrawl(
        'https://example.com',
        { baseline: 'baseline.json', json: true },
        testIo,
      );
      expect(code).toBe(EXIT_CODES.SUCCESS);
      const parsed = JSON.parse(stdoutLogs[0]!) as { readonly kind: string };
      expect(parsed.kind).toBe('multi-page');
    });
  });
});
