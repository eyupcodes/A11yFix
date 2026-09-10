import { describe, expect, it } from 'vitest';

import {
  compareMultiPageReports,
  compareReports,
  diffReports,
  isAccessibilityReport,
  isMultiPageReport,
} from './diff.js';
import { CoreError } from './errors.js';
import type { AccessibilityReport, Finding, MultiPageReport } from './types.js';

function createMockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'image-alt',
    severity: 'critical',
    wcag: {
      criteria: ['1.1.1'],
      level: 'A',
      version: '2.0',
      isBestPractice: false,
    },
    description: 'Images must have alternate text',
    help: 'Images must have alternate text',
    nodes: [
      {
        html: '<img src="logo.png">',
        target: ['img#logo'],
        failureSummary: 'Element does not have an alt attribute',
      },
    ],
    nodeCount: 1,
    remediation: {
      summary: 'Add an alt attribute',
      details: 'Specify meaningful alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
    },
    ...overrides,
  };
}

function createMockReport(
  findings: Finding[] = [createMockFinding()],
  score = 85,
  grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'B',
): AccessibilityReport {
  return {
    findings,
    score,
    grade,
    breakdown: {
      totalPenalty: 100 - score,
      countsBySeverity: {
        critical: findings.filter((f) => f.severity === 'critical').length,
        serious: findings.filter((f) => f.severity === 'serious').length,
        moderate: findings.filter((f) => f.severity === 'moderate').length,
        minor: findings.filter((f) => f.severity === 'minor').length,
      },
      scoredFindings: findings.length,
      bestPracticeFindings: 0,
    },
    ruleCounts: {
      violations: findings.length,
      passes: 20,
      incomplete: 0,
      inapplicable: 5,
    },
    meta: {
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      title: 'Example',
      scannedAt: '2026-09-10T12:00:00.000Z',
    },
  };
}

function createMockMultiPageReport(
  siteScore = 85,
  pages = [
    {
      url: 'https://example.com/',
      depth: 0,
      report: createMockReport([createMockFinding()], siteScore),
      error: null,
    },
  ],
): MultiPageReport {
  return {
    summary: {
      seedUrl: 'https://example.com/',
      totalPages: pages.length,
      successfulPages: pages.filter((p) => p.report !== null).length,
      failedPages: pages.filter((p) => p.report === null).length,
      siteScore,
      siteGrade: 'B',
      totalViolations: pages.reduce(
        (sum, p) => sum + (p.report?.findings.length ?? 0),
        0,
      ),
      totalPasses: 30,
      countsBySeverity: { critical: 1, serious: 0, moderate: 0, minor: 0 },
      durationMs: 1000,
      scannedAt: '2026-09-10T12:00:00.000Z',
    },
    pages,
    commonViolations: [],
  };
}

describe('Core Diff Engine', () => {
  describe('Type Guards', () => {
    it('accurately identifies AccessibilityReport and MultiPageReport', () => {
      const single = createMockReport();
      const multi = createMockMultiPageReport();

      expect(isAccessibilityReport(single)).toBe(true);
      expect(isAccessibilityReport(multi)).toBe(false);
      expect(isAccessibilityReport(null)).toBe(false);
      expect(isAccessibilityReport({})).toBe(false);

      expect(isMultiPageReport(multi)).toBe(true);
      expect(isMultiPageReport(single)).toBe(false);
      expect(isMultiPageReport(null)).toBe(false);
      expect(isMultiPageReport({})).toBe(false);
    });
  });

  describe('compareReports (Single Page)', () => {
    it('returns UNCHANGED status for identical reports', () => {
      const baseline = createMockReport([createMockFinding()]);
      const current = createMockReport([createMockFinding()]);

      const diff = compareReports(baseline, current);

      expect(diff.kind).toBe('single');
      expect(diff.status).toBe('UNCHANGED');
      expect(diff.scoreDelta).toBe(0);
      expect(diff.newViolations).toHaveLength(0);
      expect(diff.fixedViolations).toHaveLength(0);
      expect(diff.persistentViolations).toHaveLength(1);
      expect(diff.counts).toEqual({
        baselineTotal: 1,
        currentTotal: 1,
        newCount: 0,
        fixedCount: 0,
        persistentCount: 1,
      });
      expect(diff.rulesSummary).toHaveLength(1);
      expect(diff.rulesSummary[0]!.delta).toBe(0);
    });

    it('detects REGRESSED status when new violations are introduced', () => {
      const baselineFinding = createMockFinding({
        nodes: [
          {
            html: '<img src="1.jpg">',
            target: ['img#first'],
            failureSummary: null,
          },
        ],
      });
      const newFinding = createMockFinding({
        ruleId: 'color-contrast',
        severity: 'serious',
        nodes: [
          {
            html: '<p class="light">hi</p>',
            target: ['p.light'],
            failureSummary: null,
          },
        ],
      });

      const baseline = createMockReport([baselineFinding], 90, 'A');
      const current = createMockReport([baselineFinding, newFinding], 75, 'C');

      const diff = compareReports(baseline, current);

      expect(diff.status).toBe('REGRESSED');
      expect(diff.scoreDelta).toBe(-15);
      expect(diff.baselineScore).toBe(90);
      expect(diff.currentScore).toBe(75);
      expect(diff.newViolations).toHaveLength(1);
      expect(diff.newViolations[0]!.ruleId).toBe('color-contrast');
      expect(diff.fixedViolations).toHaveLength(0);
      expect(diff.persistentViolations).toHaveLength(1);
      expect(diff.persistentViolations[0]!.ruleId).toBe('image-alt');
      expect(diff.counts.newCount).toBe(1);
      expect(diff.counts.fixedCount).toBe(0);
    });

    it('detects IMPROVED status when existing violations are fixed', () => {
      const fixedFinding = createMockFinding();
      const baseline = createMockReport([fixedFinding], 85, 'B');
      const current = createMockReport([], 100, 'A');

      const diff = compareReports(baseline, current);

      expect(diff.status).toBe('IMPROVED');
      expect(diff.scoreDelta).toBe(15);
      expect(diff.newViolations).toHaveLength(0);
      expect(diff.fixedViolations).toHaveLength(1);
      expect(diff.fixedViolations[0]!.ruleId).toBe('image-alt');
      expect(diff.persistentViolations).toHaveLength(0);
      expect(diff.counts.fixedCount).toBe(1);
    });

    it('detects MIXED status when some violations are fixed and others are introduced', () => {
      const oldFinding = createMockFinding({
        ruleId: 'image-alt',
        nodes: [{ html: '<img>', target: ['img.old'], failureSummary: null }],
      });
      const newFinding = createMockFinding({
        ruleId: 'button-name',
        severity: 'serious',
        nodes: [
          {
            html: '<button></button>',
            target: ['button#empty'],
            failureSummary: null,
          },
        ],
      });

      const baseline = createMockReport([oldFinding], 85, 'B');
      const current = createMockReport([newFinding], 85, 'B');

      const diff = compareReports(baseline, current);

      expect(diff.status).toBe('MIXED');
      expect(diff.scoreDelta).toBe(0);
      expect(diff.fixedViolations).toHaveLength(1);
      expect(diff.fixedViolations[0]!.ruleId).toBe('image-alt');
      expect(diff.newViolations).toHaveLength(1);
      expect(diff.newViolations[0]!.ruleId).toBe('button-name');
    });

    it('handles multiset counts correctly for identical node selectors', () => {
      // Baseline has 2 identical violations
      const baselineFinding = createMockFinding({
        nodes: [
          {
            html: '<img src="1.png">',
            target: ['img.icon'],
            failureSummary: null,
          },
          {
            html: '<img src="2.png">',
            target: ['img.icon'],
            failureSummary: null,
          },
        ],
      });
      // Current has 3 identical violations (1 added regression)
      const currentFinding = createMockFinding({
        nodes: [
          {
            html: '<img src="1.png">',
            target: ['img.icon'],
            failureSummary: null,
          },
          {
            html: '<img src="2.png">',
            target: ['img.icon'],
            failureSummary: null,
          },
          {
            html: '<img src="3.png">',
            target: ['img.icon'],
            failureSummary: null,
          },
        ],
      });

      const baseline = createMockReport([baselineFinding], 80);
      const current = createMockReport([currentFinding], 70);

      const diff = compareReports(baseline, current);

      expect(diff.status).toBe('REGRESSED');
      expect(diff.persistentViolations).toHaveLength(2);
      expect(diff.newViolations).toHaveLength(1);
      expect(diff.fixedViolations).toHaveLength(0);
    });

    it('handles findings without nodes (root/document-level rules)', () => {
      const docTitle = createMockFinding({
        ruleId: 'document-title',
        severity: 'serious',
        nodes: [],
      });

      const baseline = createMockReport([docTitle], 80);
      const current = createMockReport([], 100);

      const diff = compareReports(baseline, current);

      expect(diff.status).toBe('IMPROVED');
      expect(diff.fixedViolations).toHaveLength(1);
      expect(diff.fixedViolations[0]!.ruleId).toBe('document-title');
      expect(diff.fixedViolations[0]!.target).toEqual([]);
    });

    it('throws CoreError INVALID_REPORT on invalid inputs', () => {
      expect(() => compareReports(null as never, {} as never)).toThrow(
        CoreError,
      );
      expect(() => compareReports({} as never, createMockReport())).toThrow(
        CoreError,
      );
    });
  });

  describe('compareMultiPageReports', () => {
    it('compares multi-page site crawls, tracking pages and site score deltas', () => {
      const page1 = 'https://example.com/';
      const page2 = 'https://example.com/about';

      const baselineReport = createMockMultiPageReport(85, [
        {
          url: page1,
          depth: 0,
          report: createMockReport([createMockFinding()], 85),
          error: null,
        },
      ]);

      const currentReport = createMockMultiPageReport(75, [
        {
          url: page1,
          depth: 0,
          report: createMockReport([createMockFinding()], 85),
          error: null,
        },
        {
          url: page2,
          depth: 1,
          report: createMockReport(
            [createMockFinding({ ruleId: 'color-contrast' })],
            65,
          ),
          error: null,
        },
      ]);

      const diff = compareMultiPageReports(baselineReport, currentReport);

      expect(diff.kind).toBe('multi-page');
      expect(diff.status).toBe('REGRESSED');
      expect(diff.scoreDelta).toBe(-10);
      expect(diff.baselineSiteScore).toBe(85);
      expect(diff.currentSiteScore).toBe(75);
      expect(diff.newViolations).toHaveLength(1);
      expect(diff.newViolations[0]!.ruleId).toBe('color-contrast');
      expect(diff.newViolations[0]!.pageUrl).toBe(page2);

      // Page breakdown
      expect(diff.pages).toHaveLength(2);
      expect(diff.pages[0]!.url).toBe(page1);
      expect(diff.pages[0]!.status).toBe('UNCHANGED');
      expect(diff.pages[1]!.url).toBe(page2);
      expect(diff.pages[1]!.status).toBe('NEW_PAGE');
    });

    it('handles removed pages in multi-page diffs', () => {
      const baselineReport = createMockMultiPageReport(80, [
        {
          url: 'https://example.com/',
          depth: 0,
          report: createMockReport([], 100),
          error: null,
        },
        {
          url: 'https://example.com/old',
          depth: 1,
          report: createMockReport([createMockFinding()], 60),
          error: null,
        },
      ]);

      const currentReport = createMockMultiPageReport(100, [
        {
          url: 'https://example.com/',
          depth: 0,
          report: createMockReport([], 100),
          error: null,
        },
      ]);

      const diff = compareMultiPageReports(baselineReport, currentReport);

      expect(diff.status).toBe('IMPROVED');
      expect(
        diff.pages.find((p) => p.url === 'https://example.com/old')?.status,
      ).toBe('REMOVED_PAGE');
    });

    it('throws CoreError on invalid multi-page report payload', () => {
      expect(() =>
        compareMultiPageReports(null as never, createMockMultiPageReport()),
      ).toThrow(CoreError);
    });
  });

  describe('diffReports (Polymorphic)', () => {
    it('dispatches to compareReports for single-page reports', () => {
      const single1 = createMockReport();
      const single2 = createMockReport();
      const diff = diffReports(single1, single2);
      expect(diff.kind).toBe('single');
    });

    it('dispatches to compareMultiPageReports for multi-page reports', () => {
      const multi1 = createMockMultiPageReport();
      const multi2 = createMockMultiPageReport();
      const diff = diffReports(multi1, multi2);
      expect(diff.kind).toBe('multi-page');
    });

    it('throws CoreError when comparing mismatched single and multi-page reports', () => {
      const single = createMockReport();
      const multi = createMockMultiPageReport();
      expect(() => diffReports(single, multi)).toThrow(CoreError);
    });
  });
});
