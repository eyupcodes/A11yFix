import { describe, expect, it } from 'vitest';

import type {
  AccessibilityReport,
  Finding,
  MultiPageReport,
} from '@a11yfix/core';

import { ReporterError } from './errors.js';
import { buildSarifLog, renderSarifReport, type SarifLog } from './sarif.js';

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
        html: '<img src="test.jpg">',
        target: ['body', 'img.hero'],
        failureSummary: 'Missing alt attribute',
      },
    ],
    nodeCount: 1,
    remediation: {
      summary: 'Images must have alternate text',
      details:
        'Fix any of the following: Element does not have an alt attribute',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
    },
    ...overrides,
  };
}

function createMockReport(
  findings: Finding[] = [createMockFinding()],
): AccessibilityReport {
  return {
    findings,
    score: 85,
    grade: 'B',
    breakdown: {
      totalPenalty: 15,
      countsBySeverity: { critical: 1, serious: 0, moderate: 0, minor: 0 },
      scoredFindings: 1,
      bestPracticeFindings: 0,
    },
    ruleCounts: {
      violations: findings.length,
      passes: 20,
      incomplete: 1,
      inapplicable: 10,
    },
    meta: {
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/home',
      title: 'Example Home',
      scannedAt: '2026-09-10T12:00:00.000Z',
    },
  };
}

function createMockMultiPageReport(): MultiPageReport {
  const page1Report = createMockReport([
    createMockFinding({
      ruleId: 'image-alt',
      severity: 'critical',
    }),
  ]);

  const page2Report = createMockReport([
    createMockFinding({
      ruleId: 'image-alt',
      severity: 'critical',
    }),
    createMockFinding({
      ruleId: 'color-contrast',
      severity: 'serious',
      wcag: {
        criteria: ['1.4.3'],
        level: 'AA',
        version: '2.0',
        isBestPractice: false,
      },
      description: 'Elements must meet minimum color contrast ratio thresholds',
      help: 'Elements must have sufficient color contrast',
      nodes: [
        {
          html: '<p class="faint">Light text</p>',
          target: ['p.faint'],
          failureSummary: 'Element has insufficient color contrast of 2.5:1',
        },
      ],
      remediation: {
        summary: 'Increase color contrast',
        details: 'Expected contrast ratio of 4.5:1',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
      },
    }),
  ]);

  return {
    summary: {
      seedUrl: 'https://example.com/',
      totalPages: 2,
      successfulPages: 2,
      failedPages: 0,
      siteScore: 80,
      siteGrade: 'B',
      totalViolations: 3,
      totalPasses: 40,
      countsBySeverity: { critical: 2, serious: 1, moderate: 0, minor: 0 },
      durationMs: 1200,
      scannedAt: '2026-09-10T12:00:00.000Z',
    },
    pages: [
      {
        url: 'https://example.com/',
        depth: 0,
        report: page1Report,
        error: null,
      },
      {
        url: 'https://example.com/about',
        depth: 1,
        report: page2Report,
        error: null,
      },
    ],
    commonViolations: [],
  };
}

describe('SARIF v2.1.0 generator', () => {
  describe('buildSarifLog', () => {
    it('produces valid root schema and tool driver for single-page report', () => {
      const report = createMockReport();
      const sarif = buildSarifLog(report);

      expect(sarif.$schema).toBe(
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      );
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs).toHaveLength(1);

      const run = sarif.runs[0]!;
      expect(run.tool.driver.name).toBe('A11yFix');
      expect(run.tool.driver.version).toBe('0.1.0');
      expect(run.tool.driver.informationUri).toBe(
        'https://github.com/eyupcodes/A11yFix',
      );
    });

    it('maps rules with tags, descriptions, help URIs, and severity levels', () => {
      const finding = createMockFinding({
        wcag: {
          criteria: ['1.1.1', '1.4.3'],
          level: 'AA',
          version: '2.1',
          isBestPractice: true,
        },
      });
      const report = createMockReport([finding]);
      const sarif = buildSarifLog(report);
      const rules = sarif.runs[0]!.tool.driver.rules;

      expect(rules).toHaveLength(1);
      const rule = rules[0]!;
      expect(rule.id).toBe('image-alt');
      expect(rule.name).toBe('image-alt');
      expect(rule.shortDescription.text).toBe(finding.help);
      expect(rule.fullDescription.text).toBe(finding.description);
      expect(rule.helpUri).toBe(finding.remediation.helpUrl);
      expect(rule.help?.markdown).toContain(
        '### Images must have alternate text',
      );
      expect(rule.help?.markdown).toContain(
        '**WCAG Criteria:** 1.1.1, 1.4.3 (Level AA)',
      );
      expect(rule.defaultConfiguration.level).toBe('error');
      expect(rule.properties['problem.severity']).toBe('error');
      expect(rule.properties.tags).toEqual([
        'accessibility',
        'wcag2aa',
        'wcag111',
        'wcag143',
        'best-practice',
      ]);
    });

    it('correctly maps severity levels to SARIF levels', () => {
      const severities = [
        { severity: 'critical' as const, expected: 'error' },
        { severity: 'serious' as const, expected: 'error' },
        { severity: 'moderate' as const, expected: 'warning' },
        { severity: 'minor' as const, expected: 'note' },
      ];

      for (const { severity, expected } of severities) {
        const finding = createMockFinding({
          ruleId: `rule-${severity}`,
          severity,
        });
        const report = createMockReport([finding]);
        const sarif = buildSarifLog(report);
        const rule = sarif.runs[0]!.tool.driver.rules[0]!;
        const result = sarif.runs[0]!.results[0]!;

        expect(rule.defaultConfiguration.level).toBe(expected);
        expect(result.level).toBe(expected);
      }
    });

    it('maps result locations with artifact URI, snippet, and logical target selector', () => {
      const report = createMockReport();
      const sarif = buildSarifLog(report);
      const results = sarif.runs[0]!.results;

      expect(results).toHaveLength(1);
      const result = results[0]!;
      expect(result.ruleId).toBe('image-alt');
      expect(result.ruleIndex).toBe(0);
      expect(result.level).toBe('error');
      expect(result.message.text).toBe('Missing alt attribute');

      expect(result.locations).toHaveLength(1);
      const location = result.locations![0]!;
      expect(location.physicalLocation?.artifactLocation.uri).toBe(
        'https://example.com/home',
      );
      expect(location.physicalLocation?.region?.snippet?.text).toBe(
        '<img src="test.jpg">',
      );
      expect(location.logicalLocations).toEqual([
        { fullyQualifiedName: 'body img.hero', kind: 'element' },
      ]);
    });

    it('handles findings with multiple nodes as individual results', () => {
      const multiNodeFinding = createMockFinding({
        nodes: [
          {
            html: '<img src="1.jpg">',
            target: ['img#first'],
            failureSummary: 'Missing alt 1',
          },
          {
            html: '<img src="2.jpg">',
            target: ['img#second'],
            failureSummary: 'Missing alt 2',
          },
        ],
        nodeCount: 2,
      });

      const report = createMockReport([multiNodeFinding]);
      const sarif = buildSarifLog(report);
      const results = sarif.runs[0]!.results;

      expect(results).toHaveLength(2);
      expect(
        results[0]!.locations![0]!.physicalLocation?.region?.snippet?.text,
      ).toBe('<img src="1.jpg">');
      expect(
        results[1]!.locations![0]!.physicalLocation?.region?.snippet?.text,
      ).toBe('<img src="2.jpg">');
    });

    it('handles findings without nodes as a fallback result', () => {
      const emptyNodeFinding = createMockFinding({
        nodes: [],
        nodeCount: 0,
      });

      const report = createMockReport([emptyNodeFinding]);
      const sarif = buildSarifLog(report);
      const results = sarif.runs[0]!.results;

      expect(results).toHaveLength(1);
      expect(
        results[0]!.locations![0]!.physicalLocation?.artifactLocation.uri,
      ).toBe('https://example.com/home');
      expect(
        results[0]!.locations![0]!.physicalLocation?.region,
      ).toBeUndefined();
    });

    it('processes MultiPageReport, deduplicating rules and setting page-specific URIs', () => {
      const multiPageReport = createMockMultiPageReport();
      const sarif = buildSarifLog(multiPageReport);
      const rules = sarif.runs[0]!.tool.driver.rules;
      const results = sarif.runs[0]!.results;

      // Rules should be deduplicated: image-alt (on page 1 & 2) and color-contrast (on page 2)
      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.id)).toEqual(['image-alt', 'color-contrast']);

      // 3 node occurrences total: 1 image-alt on page 1, 1 image-alt on page 2, 1 color-contrast on page 2
      expect(results).toHaveLength(3);

      expect(results[0]!.ruleId).toBe('image-alt');
      expect(
        results[0]!.locations![0]!.physicalLocation?.artifactLocation.uri,
      ).toBe('https://example.com/');

      expect(results[1]!.ruleId).toBe('image-alt');
      expect(
        results[1]!.locations![0]!.physicalLocation?.artifactLocation.uri,
      ).toBe('https://example.com/about');

      expect(results[2]!.ruleId).toBe('color-contrast');
      expect(
        results[2]!.locations![0]!.physicalLocation?.artifactLocation.uri,
      ).toBe('https://example.com/about');
    });

    it('throws ReporterError for invalid report payload', () => {
      expect(() => buildSarifLog(null as never)).toThrow(ReporterError);
      expect(() => buildSarifLog({} as never)).toThrow(ReporterError);
    });
  });

  describe('renderSarifReport', () => {
    it('serializes report to compact JSON by default', () => {
      const report = createMockReport();
      const output = renderSarifReport(report);

      expect(typeof output).toBe('string');
      expect(output).not.toContain('\n  ');
      const parsed = JSON.parse(output) as SarifLog;
      expect(parsed.version).toBe('2.1.0');
    });

    it('pretty-prints JSON when pretty: true', () => {
      const report = createMockReport();
      const output = renderSarifReport(report, { pretty: true });

      expect(output).toContain('\n  ');
      const parsed = JSON.parse(output) as SarifLog;
      expect(parsed.version).toBe('2.1.0');
    });
  });
});
