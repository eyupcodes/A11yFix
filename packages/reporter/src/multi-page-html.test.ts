import { describe, expect, it } from 'vitest';

import { renderMultiPageHtmlReport } from './multi-page-html.js';
import type { MultiPageReport } from '@a11yfix/core';

function fakeReport(overrides?: Partial<MultiPageReport>): MultiPageReport {
  return {
    summary: {
      seedUrl: 'https://example.com/',
      totalPages: 2,
      successfulPages: 2,
      failedPages: 0,
      siteScore: 88,
      siteGrade: 'B',
      totalViolations: 4,
      totalPasses: 20,
      countsBySeverity: { critical: 1, serious: 1, moderate: 1, minor: 1 },
      durationMs: 500,
      scannedAt: new Date().toISOString(),
    },
    pages: [
      {
        url: 'https://example.com/',
        depth: 0,
        report: {
          findings: [
            {
              ruleId: 'image-alt',
              severity: 'critical',
              description: 'Images must have alt',
              help: 'Add alt text',
              wcag: {
                criteria: ['1.1.1'],
                level: 'A',
                version: '2.0',
                isBestPractice: false,
              },
              nodes: [],
              nodeCount: 1,
              remediation: {
                summary: 'Add alt text',
                details: null,
                helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
              },
            },
          ],
          score: 90,
          grade: 'A',
          breakdown: {
            totalPenalty: 10,
            countsBySeverity: {
              critical: 1,
              serious: 0,
              moderate: 0,
              minor: 0,
            },
            scoredFindings: 1,
            bestPracticeFindings: 0,
          },
          ruleCounts: {
            violations: 1,
            passes: 10,
            incomplete: 0,
            inapplicable: 0,
          },
          meta: {
            requestedUrl: 'https://example.com/',
            finalUrl: 'https://example.com/',
            title: 'Example',
            scannedAt: new Date().toISOString(),
          },
        } as never,
        error: null,
      },
      {
        url: 'https://example.com/about',
        depth: 1,
        report: {
          findings: [],
          score: 85,
          grade: 'B',
          breakdown: {
            totalPenalty: 15,
            countsBySeverity: {
              critical: 0,
              serious: 1,
              moderate: 0,
              minor: 0,
            },
            scoredFindings: 1,
            bestPracticeFindings: 0,
          },
          ruleCounts: {
            violations: 1,
            passes: 10,
            incomplete: 0,
            inapplicable: 0,
          },
          meta: {
            requestedUrl: 'https://example.com/about',
            finalUrl: 'https://example.com/about',
            title: 'About',
            scannedAt: new Date().toISOString(),
          },
        } as never,
        error: null,
      },
    ],
    commonViolations: [],
    ...overrides,
  } as unknown as MultiPageReport;
}

describe('renderMultiPageHtmlReport', () => {
  it('produces standalone HTML5 document with expected sections and escaped content', () => {
    const html = renderMultiPageHtmlReport(fakeReport());
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('lang="en"');
    expect(html).toContain('Site Summary');
    expect(html).toContain('Recurring Violations');
    expect(html).toContain('Pages Scanned');
    expect(html).toContain('https://example.com/');
    expect(html).toContain('Site Score');
    expect(html).toContain('Grade B');
    expect(html).toContain('role="banner"');
    expect(html).toContain('role="main"');
    expect(html).toContain('Skip to main content');
  });

  it('escapes malicious content and validates input', () => {
    const malicious = fakeReport({
      summary: {
        seedUrl: '<script>alert(1)</script>',
        totalPages: 1,
        successfulPages: 0,
        failedPages: 1,
        siteScore: 0,
        siteGrade: 'F' as const,
        totalViolations: 0,
        totalPasses: 0,
        countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        durationMs: 10,
        scannedAt: new Date().toISOString(),
      },
    });

    const html = renderMultiPageHtmlReport(malicious);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(() => renderMultiPageHtmlReport(null as never)).toThrow();
  });
});
