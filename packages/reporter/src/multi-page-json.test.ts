import { describe, expect, it } from 'vitest';

import { renderMultiPageJsonReport } from './multi-page-json.js';
import type { MultiPageReport } from '@a11yfix/core';

function fakeReport(): MultiPageReport {
  return {
    summary: {
      seedUrl: 'https://example.com/',
      totalPages: 1,
      successfulPages: 1,
      failedPages: 0,
      siteScore: 95,
      siteGrade: 'A',
      totalViolations: 0,
      totalPasses: 10,
      countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      durationMs: 200,
      scannedAt: new Date().toISOString(),
    },
    pages: [
      {
        url: 'https://example.com/',
        depth: 0,
        report: null,
        error: null,
      },
    ],
    commonViolations: [],
  } as unknown as MultiPageReport;
}

describe('renderMultiPageJsonReport', () => {
  it('serializes a multi-page report to valid JSON', () => {
    const r = fakeReport();
    const json = renderMultiPageJsonReport(r);
    const parsed = JSON.parse(json) as MultiPageReport;
    expect(parsed.summary.siteScore).toBe(95);
    expect(parsed.pages[0]!.url).toBe('https://example.com/');
  });

  it('pretty-prints when pretty=true', () => {
    const json = renderMultiPageJsonReport(fakeReport(), { pretty: true });
    expect(json).toContain('\n  ');
  });

  it('throws for invalid report shape', () => {
    expect(() => renderMultiPageJsonReport(null as never)).toThrow();
    expect(() => renderMultiPageJsonReport({ summary: {} } as never)).toThrow();
  });
});
