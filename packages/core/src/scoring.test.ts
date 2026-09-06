import { describe, expect, it } from 'vitest';

import { scoreFindings } from './scoring.js';
import type { Finding } from './types.js';

function finding(overrides: Partial<Finding> & { ruleId: string }): Finding {
  return {
    severity: 'serious',
    wcag: {
      criteria: ['1.4.3'],
      level: 'AA',
      version: '2.0',
      isBestPractice: false,
    },
    description: 'description',
    help: 'help',
    nodes: [],
    nodeCount: 1,
    remediation: { summary: 'help', details: null, helpUrl: '' },
    ...overrides,
  };
}

function bestPractice(ruleId: string): Finding {
  return finding({
    ruleId,
    severity: 'serious',
    nodeCount: 5,
    wcag: {
      criteria: [],
      level: null,
      version: null,
      isBestPractice: true,
    },
  });
}

describe('scoreFindings', () => {
  it('scores a clean run as 100/A', () => {
    const scored = scoreFindings([]);

    expect(scored.score).toBe(100);
    expect(scored.grade).toBe('A');
    expect(scored.breakdown).toEqual({
      totalPenalty: 0,
      countsBySeverity: {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      },
      scoredFindings: 0,
      bestPracticeFindings: 0,
    });
  });

  it('subtracts severity weight times node count', () => {
    // serious weight 5 × 2 nodes = 10 → 90.
    const scored = scoreFindings([
      finding({ ruleId: 'color-contrast', nodeCount: 2 }),
    ]);

    expect(scored.score).toBe(90);
    expect(scored.grade).toBe('A');
    expect(scored.breakdown.totalPenalty).toBe(10);
    expect(scored.breakdown.countsBySeverity.serious).toBe(1);
  });

  it('caps the node contribution per finding', () => {
    const capped = scoreFindings([
      finding({ ruleId: 'a', severity: 'minor', nodeCount: 100 }),
    ]);
    const atCap = scoreFindings([
      finding({ ruleId: 'a', severity: 'minor', nodeCount: 10 }),
    ]);

    expect(capped.breakdown.totalPenalty).toBe(atCap.breakdown.totalPenalty);
  });

  it('excludes best-practice findings from the score', () => {
    const scored = scoreFindings([bestPractice('accesskeys')]);

    expect(scored.score).toBe(100);
    expect(scored.grade).toBe('A');
    expect(scored.breakdown.scoredFindings).toBe(0);
    expect(scored.breakdown.bestPracticeFindings).toBe(1);
  });

  it('clamps the score at zero under heavy penalties', () => {
    const findings = Array.from({ length: 20 }, (_, index) =>
      finding({ ruleId: `rule-${index}`, severity: 'critical', nodeCount: 10 }),
    );

    const scored = scoreFindings(findings);

    expect(scored.score).toBe(0);
    expect(scored.grade).toBe('F');
  });

  it('assigns grade bands at their boundaries', () => {
    // minor weight 1 × 1 node = penalty 1 per finding: exact scores.
    const atScore = (score: number) =>
      scoreFindings(
        Array.from({ length: 100 - score }, (_, index) =>
          finding({ ruleId: `g-${index}`, severity: 'minor', nodeCount: 1 }),
        ),
      );

    expect(atScore(90).grade).toBe('A');
    expect(atScore(89).grade).toBe('B');
    expect(atScore(80).grade).toBe('B');
    expect(atScore(79).grade).toBe('C');
    expect(atScore(70).grade).toBe('C');
    expect(atScore(69).grade).toBe('D');
    expect(atScore(60).grade).toBe('D');
    expect(atScore(59).grade).toBe('F');
  });
});
