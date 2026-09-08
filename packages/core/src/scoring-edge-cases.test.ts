import { describe, expect, it } from 'vitest';

import { analyzeAxeResults } from './normalize.js';
import {
  findingPenalty,
  gradeForScore,
  NODE_IMPACT_CAP,
  scoreFindings,
} from './scoring.js';
import type { Finding, Severity } from './types.js';

function createMockFinding(
  overrides: Partial<Finding> & { severity: Severity; nodeCount: number },
): Finding {
  return {
    ruleId: overrides.ruleId ?? 'test-rule',
    severity: overrides.severity,
    nodeCount: overrides.nodeCount,
    description: 'Test finding description',
    help: 'Test finding help',
    wcag: overrides.wcag ?? {
      criteria: ['1.1.1'],
      level: 'A',
      version: '2.1',
      isBestPractice: false,
    },
    remediation: {
      summary: 'Fix the issue',
      helpUrl: 'https://example.com/rule',
      details: null,
    },
    nodes: Array.from({ length: overrides.nodeCount }, (_, i) => ({
      html: `<div id="node-${i}"></div>`,
      target: [`#node-${i}`],
      failureSummary: 'Fix node',
    })),
  };
}

describe('scoring edge cases & boundary conditions', () => {
  describe('findingPenalty calculation and node capping', () => {
    it.each([
      ['critical', 1, 10],
      ['critical', 5, 50],
      ['critical', 10, 100],
      ['critical', 11, 100], // capped at 10
      ['critical', 250, 100], // capped at 10
      ['serious', 1, 5],
      ['serious', 10, 50],
      ['serious', 20, 50], // capped at 10
      ['moderate', 1, 2],
      ['moderate', 10, 20],
      ['moderate', 99, 20], // capped at 10
      ['minor', 1, 1],
      ['minor', 10, 10],
      ['minor', 100, 10], // capped at 10
      ['critical', 0, 0],
      ['serious', 0, 0],
    ] as const)(
      'evaluates severity %s with %i nodes to penalty %i',
      (severity, nodeCount, expectedPenalty) => {
        const finding = createMockFinding({ severity, nodeCount });
        expect(findingPenalty(finding)).toBe(expectedPenalty);
      },
    );

    it('enforces NODE_IMPACT_CAP constant of 10', () => {
      expect(NODE_IMPACT_CAP).toBe(10);
    });
  });

  describe('gradeForScore boundary checks', () => {
    it.each([
      [100, 'A'],
      [95, 'A'],
      [90, 'A'],
      [89.9, 'B'],
      [89, 'B'],
      [85, 'B'],
      [80, 'B'],
      [79.9, 'C'],
      [79, 'C'],
      [75, 'C'],
      [70, 'C'],
      [69.9, 'D'],
      [69, 'D'],
      [65, 'D'],
      [60, 'D'],
      [59.9, 'F'],
      [59, 'F'],
      [30, 'F'],
      [0, 'F'],
      [-10, 'F'],
    ] as const)('maps score %s to grade %s', (score, expectedGrade) => {
      expect(gradeForScore(score)).toBe(expectedGrade);
    });
  });

  describe('scoreFindings score clamping and breakdown accounting', () => {
    it('clamps score at 0 when penalty exceeds 100 while preserving totalPenalty in breakdown', () => {
      const findings = [
        createMockFinding({
          ruleId: 'r1',
          severity: 'critical',
          nodeCount: 10,
        }), // 100
        createMockFinding({
          ruleId: 'r2',
          severity: 'critical',
          nodeCount: 10,
        }), // 100
        createMockFinding({ ruleId: 'r3', severity: 'serious', nodeCount: 10 }), // 50
      ];

      const result = scoreFindings(findings);

      expect(result.score).toBe(0);
      expect(result.grade).toBe('F');
      expect(result.breakdown.totalPenalty).toBe(250);
      expect(result.breakdown.scoredFindings).toBe(3);
      expect(result.breakdown.countsBySeverity.critical).toBe(2);
      expect(result.breakdown.countsBySeverity.serious).toBe(1);
    });

    it('returns 100 and Grade A for an empty finding list', () => {
      const result = scoreFindings([]);

      expect(result.score).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.breakdown.totalPenalty).toBe(0);
      expect(result.breakdown.scoredFindings).toBe(0);
      expect(result.breakdown.bestPracticeFindings).toBe(0);
      expect(result.breakdown.countsBySeverity).toEqual({
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      });
    });

    it('excludes best-practice findings from penalty while counting them in breakdown', () => {
      const findings = [
        createMockFinding({
          ruleId: 'best-1',
          severity: 'critical',
          nodeCount: 10,
          wcag: {
            criteria: [],
            level: null,
            version: null,
            isBestPractice: true,
          },
        }),
        createMockFinding({
          ruleId: 'best-2',
          severity: 'serious',
          nodeCount: 10,
          wcag: {
            criteria: [],
            level: null,
            version: null,
            isBestPractice: true,
          },
        }),
        createMockFinding({
          ruleId: 'wcag-minor',
          severity: 'minor',
          nodeCount: 2,
          wcag: {
            criteria: ['1.1.1'],
            level: 'A',
            version: '2.1',
            isBestPractice: false,
          },
        }),
      ];

      const result = scoreFindings(findings);

      // Only wcag-minor contributes penalty: 1 * 2 = 2
      expect(result.breakdown.totalPenalty).toBe(2);
      expect(result.score).toBe(98);
      expect(result.grade).toBe('A');
      expect(result.breakdown.scoredFindings).toBe(1);
      expect(result.breakdown.bestPracticeFindings).toBe(2);
      expect(result.breakdown.countsBySeverity.minor).toBe(1);
      expect(result.breakdown.countsBySeverity.critical).toBe(0);
    });
  });

  describe('analyzeAxeResults resilience and sorting stability', () => {
    it('handles unexpected/unrecognized impact by falling back to moderate', () => {
      const report = analyzeAxeResults({
        violations: [
          {
            id: 'weird-impact',
            impact: 'unrecognized_level' as never,
            tags: ['wcag2a', 'wcag111'],
            description: 'Weird impact rule',
            help: 'Help',
            helpUrl: 'https://example.com',
            nodes: [{ html: '<div></div>', target: ['div'] }],
          },
        ],
        passes: [],
        incomplete: [],
        inapplicable: [],
      });

      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]?.severity).toBe('moderate');
      // moderate weight 2 * 1 node = 2 penalty -> score 98
      expect(report.score).toBe(98);
    });

    it('maintains deterministic alphabetical sort when severity and node counts match', () => {
      const report = analyzeAxeResults({
        violations: [
          {
            id: 'zebra-rule',
            impact: 'serious',
            tags: ['wcag2a', 'wcag111'],
            description: 'Zebra',
            help: 'Help',
            helpUrl: 'https://example.com',
            nodes: [{ html: '<div></div>', target: ['div'] }],
          },
          {
            id: 'alpha-rule',
            impact: 'serious',
            tags: ['wcag2a', 'wcag111'],
            description: 'Alpha',
            help: 'Help',
            helpUrl: 'https://example.com',
            nodes: [{ html: '<div></div>', target: ['div'] }],
          },
          {
            id: 'beta-rule',
            impact: 'serious',
            tags: ['wcag2a', 'wcag111'],
            description: 'Beta',
            help: 'Help',
            helpUrl: 'https://example.com',
            nodes: [{ html: '<div></div>', target: ['div'] }],
          },
        ],
        passes: [],
        incomplete: [],
        inapplicable: [],
      });

      expect(report.findings.map((f) => f.ruleId)).toEqual([
        'alpha-rule',
        'beta-rule',
        'zebra-rule',
      ]);
    });

    it('deduplicates criteria tags and extracts multiple criteria correctly', () => {
      const report = analyzeAxeResults({
        violations: [
          {
            id: 'multi-tag-rule',
            impact: 'moderate',
            tags: [
              'wcag2a',
              'wcag111',
              'wcag111', // duplicate
              'wcag21a',
              'wcag1412', // multiple criteria
              'cat.text-alternatives',
            ],
            description: 'Multi tag',
            help: 'Help',
            helpUrl: 'https://example.com',
            nodes: [{ html: '<div></div>', target: ['div'] }],
          },
        ],
        passes: [],
        incomplete: [],
        inapplicable: [],
      });

      const finding = report.findings[0];
      expect(finding).toBeDefined();
      expect(finding?.wcag.criteria).toEqual(['1.1.1', '1.4.12']);
      expect(finding?.wcag.level).toBe('A');
      expect(finding?.wcag.isBestPractice).toBe(false);
    });
  });
});
