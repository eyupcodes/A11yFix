import type { MultiPageReportDiff, SingleReportDiff } from '@a11yfix/core';
import { describe, expect, it } from 'vitest';

import { renderDiffHtmlReport } from './diff-html.js';
import { renderDiffJsonReport } from './diff-json.js';
import { ReporterError } from './errors.js';

function createMockSingleDiff(
  overrides: Partial<SingleReportDiff> = {},
): SingleReportDiff {
  return {
    kind: 'single',
    baselineScore: 85,
    currentScore: 75,
    scoreDelta: -10,
    baselineGrade: 'B',
    currentGrade: 'C',
    status: 'REGRESSED',
    newViolations: [
      {
        ruleId: 'image-alt',
        severity: 'critical',
        help: 'Images must have alternate text',
        description:
          'Ensures <img> elements have alternate text or a role of none or presentation',
        target: ['img#logo'],
        html: '<img src="logo.png">',
        failureSummary:
          'Fix any of the following: Element does not have an alt attribute',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
        pageUrl: 'https://example.com/',
      },
    ],
    fixedViolations: [
      {
        ruleId: 'color-contrast',
        severity: 'serious',
        help: 'Elements must have sufficient color contrast',
        description:
          'Ensures the contrast between foreground and background colors meets WCAG 2 AA thresholds',
        target: ['button.submit'],
        html: '<button class="submit">Submit</button>',
        failureSummary: 'Element has insufficient color contrast of 2.5:1',
      },
    ],
    persistentViolations: [
      {
        ruleId: 'document-title',
        severity: 'moderate',
        help: 'Documents must have <title> element',
        description:
          'Ensures each HTML document contains a non-empty <title> element',
        target: [],
        html: '',
        failureSummary: null,
      },
    ],
    rulesSummary: [
      {
        ruleId: 'image-alt',
        severity: 'critical',
        help: 'Images must have alternate text',
        baselineCount: 0,
        currentCount: 1,
        delta: 1,
      },
    ],
    counts: {
      baselineTotal: 2,
      currentTotal: 2,
      newCount: 1,
      fixedCount: 1,
      persistentCount: 1,
    },
    ...overrides,
  };
}

function createMockMultiDiff(
  overrides: Partial<MultiPageReportDiff> = {},
): MultiPageReportDiff {
  return {
    kind: 'multi-page',
    baselineSiteScore: 90,
    currentSiteScore: 80,
    scoreDelta: -10,
    baselineGrade: 'A',
    currentGrade: 'B',
    status: 'REGRESSED',
    newViolations: [
      {
        ruleId: 'link-name',
        severity: 'serious',
        help: 'Links must have discernible text',
        description: 'Ensures links have discernible text',
        target: ['a.empty'],
        html: '<a href="/test"></a>',
        failureSummary: 'Element has no text',
        pageUrl: 'https://example.com/about',
      },
    ],
    fixedViolations: [],
    persistentViolations: [],
    pages: [
      {
        url: 'https://example.com/',
        status: 'UNCHANGED',
        baselineScore: 90,
        currentScore: 90,
        scoreDelta: 0,
        newCount: 0,
        fixedCount: 0,
        persistentCount: 0,
      },
      {
        url: 'https://example.com/about',
        status: 'NEW_PAGE',
        baselineScore: null,
        currentScore: 70,
        scoreDelta: null,
        newCount: 1,
        fixedCount: 0,
        persistentCount: 0,
      },
    ],
    counts: {
      baselineTotal: 0,
      currentTotal: 1,
      newCount: 1,
      fixedCount: 0,
      persistentCount: 0,
    },
    ...overrides,
  };
}

describe('renderDiffJsonReport', () => {
  it('serializes single report diff to compact json by default', () => {
    const diff = createMockSingleDiff();
    const json = renderDiffJsonReport(diff);
    expect(json).toBe(JSON.stringify(diff));
    expect(JSON.parse(json)).toEqual(diff);
  });

  it('serializes with indentation when pretty option is true', () => {
    const diff = createMockSingleDiff();
    const json = renderDiffJsonReport(diff, { pretty: true });
    expect(json).toBe(JSON.stringify(diff, null, 2));
  });

  it('throws ReporterError INVALID_REPORT for non-diff objects', () => {
    expect(() => renderDiffJsonReport(null as never)).toThrow(ReporterError);
    expect(() => renderDiffJsonReport({} as never)).toThrow(ReporterError);
  });
});

describe('renderDiffHtmlReport', () => {
  it('renders single report diff with score banner and violation cards', () => {
    const diff = createMockSingleDiff();
    const html = renderDiffHtmlReport(diff);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('A11yFix Accessibility Regression Diff');
    expect(html).toContain('Regression Detected');
    expect(html).toContain('85/100');
    expect(html).toContain('75/100');
    expect(html).toContain('-10');
    expect(html).toContain('New Violations / Regressions (1)');
    expect(html).toContain('image-alt');
    expect(html).toContain('Resolved Violations (1)');
    expect(html).toContain('color-contrast');
    expect(html).toContain('Persistent Violations (1)');
    expect(html).toContain('document-title');
  });

  it('renders clean message when no regressions exist', () => {
    const diff = createMockSingleDiff({
      status: 'IMPROVED',
      scoreDelta: 15,
      newViolations: [],
      counts: {
        baselineTotal: 1,
        currentTotal: 0,
        newCount: 0,
        fixedCount: 1,
        persistentCount: 0,
      },
    });
    const html = renderDiffHtmlReport(diff);

    expect(html).toContain('No Regressions Detected');
    expect(html).toContain('+15');
    expect(html).not.toContain('New Violations / Regressions (');
  });

  it('renders multi-page report diff with per-page table', () => {
    const diff = createMockMultiDiff();
    const html = renderDiffHtmlReport(diff);

    expect(html).toContain('Per-Page Breakdown (2 pages)');
    expect(html).toContain('https://example.com/');
    expect(html).toContain('https://example.com/about');
    expect(html).toContain('NEW_PAGE');
  });

  it('escapes user strings preventing XSS', () => {
    const diff = createMockSingleDiff({
      newViolations: [
        {
          ruleId: 'custom-<script>alert(1)</script>',
          severity: 'critical',
          help: '<img src=x onerror=alert(2)>',
          description: 'Desc with <b>HTML</b>',
          target: ['<script>tag</script>'],
          html: '<div>&"\'<script></div>',
          failureSummary: '<svg onload=alert(3)>',
          helpUrl: 'https://example.com/?a=1&b=2" onclick="alert(4)',
        },
      ],
    });

    const html = renderDiffHtmlReport(diff);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).not.toContain('<svg onload=alert(3)>');
    expect(html).not.toContain('onclick="alert(4)"');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('throws ReporterError INVALID_REPORT for invalid input', () => {
    expect(() => renderDiffHtmlReport(null as never)).toThrow(ReporterError);
    expect(() => renderDiffHtmlReport({} as never)).toThrow(ReporterError);
  });
});
