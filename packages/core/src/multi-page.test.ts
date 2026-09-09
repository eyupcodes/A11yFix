import { describe, expect, it } from 'vitest';

import { analyzeCrawlResults } from './multi-page.js';
import type { CrawlInput } from './types.js';

function minimalViolation(
  overrides: {
    ruleId?: string;
    impact?: string;
    help?: string;
    html?: string;
    tag?: string;
  } = {},
) {
  const ruleId = overrides.ruleId ?? 'image-alt';
  return {
    id: ruleId,
    impact: overrides.impact ?? 'critical',
    description: `${ruleId} description`,
    help: overrides.help ?? `${ruleId} help`,
    helpUrl: `https://dequeuniversity.com/rules/axe/4.10/${ruleId}`,
    tags: overrides.tag
      ? [overrides.tag, 'wcag2a', 'wcag111']
      : ['wcag2a', 'wcag111'],
    nodes: [
      {
        html: overrides.html ?? '<img src="x.png">',
        target: [['img']],
        failureSummary: 'Fix this',
      },
    ],
  };
}

function toCrawlInput(
  pages: Array<{
    url: string;
    violations: ReturnType<typeof minimalViolation>[];
  }>,
): CrawlInput {
  return {
    seedUrl: 'https://example.com/',
    pages: pages.map((p, i) => ({
      url: p.url,
      depth: i,
      scanResult: {
        requestedUrl: p.url,
        finalUrl: p.url,
        title: p.url,
        scannedAt: new Date().toISOString(),
        durationMs: 100,
        axe: {
          violations: p.violations,
          passes: [],
          incomplete: [],
          inapplicable: [],
          url: p.url,
          toolOptions: {},
          testEngine: { name: 'axe-core' },
          testRunner: { name: 'axe' },
          testEnvironment: { userAgent: '' },
          timestamp: new Date().toISOString(),
        },
      },
    })),
    durationMs: 1000,
    startedAt: new Date().toISOString(),
  };
}

describe('analyzeCrawlResults', () => {
  it('produces correct site score (mean) and site grade', () => {
    const input = toCrawlInput([
      {
        url: 'https://example.com/',
        violations: [
          minimalViolation({ ruleId: 'image-alt', impact: 'critical' }),
        ],
      },
      { url: 'https://example.com/about', violations: [] },
    ]);

    const result = analyzeCrawlResults(input);
    // Page 1: penalized (critical * 1 node = 10 -> score 90), Page 2: perfect (100), average ~95
    expect(result.summary.totalPages).toBe(2);
    expect(result.summary.successfulPages).toBe(2);
    expect(result.summary.failedPages).toBe(0);
    expect(result.summary.siteScore).toBe(95);
    expect(result.summary.siteGrade).toBe('A');
    expect(result.pages.length).toBe(2);
  });

  it('aggregates recurring violations across pages with isSiteWide flag', () => {
    const input = toCrawlInput([
      {
        url: 'https://example.com/a',
        violations: [
          minimalViolation({ ruleId: 'color-contrast', impact: 'serious' }),
        ],
      },
      {
        url: 'https://example.com/b',
        violations: [
          minimalViolation({ ruleId: 'color-contrast', impact: 'serious' }),
        ],
      },
    ]);

    const result = analyzeCrawlResults(input);
    const contrast = result.commonViolations.find(
      (v) => v.ruleId === 'color-contrast',
    );
    expect(contrast).toBeDefined();
    expect(contrast!.occurrenceCount).toBe(2);
    expect(contrast!.isSiteWide).toBe(true);
    expect(contrast!.totalNodes).toBe(2);
    expect(contrast!.pageUrls).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('handles pages with errors as failed with siteScore 0 when no successes', () => {
    const input: CrawlInput = {
      seedUrl: 'https://example.com/',
      pages: [
        { url: 'https://example.com/broken', depth: 0, error: 'Timeout' },
      ],
      durationMs: 200,
    };

    const result = analyzeCrawlResults(input);
    expect(result.summary.siteScore).toBe(0);
    expect(result.summary.siteGrade).toBe('F');
    expect(result.summary.failedPages).toBe(1);
    expect(result.summary.successfulPages).toBe(0);
    expect(result.pages[0]!.error).toBe('Timeout');
    expect(result.pages[0]!.report).toBeNull();
    expect(result.commonViolations).toEqual([]);
  });
});
