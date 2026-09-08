import type { AccessibilityReport, Finding } from '@a11yfix/core';
import { describe, expect, it } from 'vitest';

import { renderHtmlReport } from './html.js';
import { renderJsonReport } from './json.js';
import { validateReport } from './validate.js';

function generateLargeReport(
  ruleCount: number,
  nodesPerRule: number,
): AccessibilityReport {
  const findings: Finding[] = Array.from({ length: ruleCount }, (_, r) => ({
    ruleId: `rule-${r + 1}`,
    severity: (['critical', 'serious', 'moderate', 'minor'] as const)[r % 4]!,
    nodeCount: nodesPerRule,
    description: `Automated test rule ${r + 1} description`,
    help: `Help text for rule ${r + 1}`,
    wcag: {
      criteria: ['1.1.1', '1.4.3'],
      level: 'AA',
      version: '2.1',
      isBestPractice: false,
    },
    remediation: {
      summary: `Remediation advice for rule ${r + 1}`,
      helpUrl: `https://example.com/rules/rule-${r + 1}`,
      details: null,
    },
    nodes: Array.from({ length: nodesPerRule }, (_, n) => ({
      html: `<div class="sample-element-${n}">Content for rule ${r} node ${n}</div>`,
      target: [`body > div.container > div.sample-element-${n}`],
      failureSummary: `Fix problem in node ${n}`,
    })),
  }));

  return {
    findings,
    score: 45,
    grade: 'F',
    breakdown: {
      totalPenalty: 55,
      countsBySeverity: {
        critical: Math.ceil(ruleCount / 4),
        serious: Math.floor(ruleCount / 4),
        moderate: Math.floor(ruleCount / 4),
        minor: Math.floor(ruleCount / 4),
      },
      scoredFindings: ruleCount,
      bestPracticeFindings: 0,
    },
    ruleCounts: {
      violations: ruleCount,
      passes: 20,
      incomplete: 5,
      inapplicable: 15,
    },
    meta: {
      requestedUrl: 'https://example.com/benchmark',
      finalUrl: 'https://example.com/benchmark',
      title: 'Benchmark Page',
      scannedAt: '2026-09-08T12:00:00.000Z',
    },
  };
}

describe('reporter render edge cases and performance', () => {
  it('renders large reports (100 rules, 500 nodes) in under 200ms', () => {
    const largeReport = generateLargeReport(100, 5);

    const start = performance.now();
    const html = renderHtmlReport(largeReport);
    const htmlDuration = performance.now() - start;

    expect(htmlDuration).toBeLessThan(200);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Violations (100)');
    expect(html).toContain('rule-100');

    const jsonStart = performance.now();
    const json = renderJsonReport(largeReport);
    const jsonDuration = performance.now() - jsonStart;

    expect(jsonDuration).toBeLessThan(100);
    expect(JSON.parse(json)).toEqual(largeReport);
  });

  it('renders clean reports with 0 findings and displays clean scan badge', () => {
    const cleanReport: AccessibilityReport = {
      findings: [],
      score: 100,
      grade: 'A',
      breakdown: {
        totalPenalty: 0,
        countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        scoredFindings: 0,
        bestPracticeFindings: 0,
      },
      ruleCounts: {
        violations: 0,
        passes: 45,
        incomplete: 2,
        inapplicable: 12,
      },
      meta: {
        requestedUrl: 'https://example.com/clean',
        finalUrl: 'https://example.com/clean',
        title: 'Accessible Clean Page',
        scannedAt: '2026-09-08T12:00:00.000Z',
      },
    };

    const html = renderHtmlReport(cleanReport);

    expect(html).toContain('Clean Scan!');
    expect(html).toContain(
      'No accessibility violations were detected on this page.',
    );
    expect(html).toContain('Grade A');
    expect(html).not.toContain('Violations (');
  });

  it('renders reports with null/missing metadata without throwing', () => {
    const nullMetaReport: AccessibilityReport = {
      findings: [],
      score: 100,
      grade: 'A',
      breakdown: {
        totalPenalty: 0,
        countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        scoredFindings: 0,
        bestPracticeFindings: 0,
      },
      ruleCounts: { violations: 0, passes: 1, incomplete: 0, inapplicable: 0 },
      meta: {
        requestedUrl: null,
        finalUrl: null,
        title: null,
        scannedAt: null,
      },
    };

    const html = renderHtmlReport(nullMetaReport);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Accessibility Audit Report');
    // Meta card should be empty/omitted
    expect(html).not.toContain('class="meta-card"');
  });

  it('rejects invalid reports in validateReport with INVALID_REPORT code', () => {
    expect(() => validateReport(null)).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );

    expect(() => validateReport({ score: -5 })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );

    expect(() => validateReport({ score: 105 })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );

    expect(() =>
      validateReport({
        findings: [],
        score: 95,
        grade: 'Z' as never,
        breakdown: {},
        ruleCounts: {},
        meta: {},
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REPORT' }));
  });
});
