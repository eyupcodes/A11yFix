/**
 * Prioritization scoring for normalized findings.
 *
 * The model is deliberately simple and explainable: each conformance
 * finding contributes `severity weight × capped node count` to a total
 * penalty, subtracted from a perfect 100. Best-practice findings carry
 * no WCAG obligation, so they are reported separately and never move
 * the conformance score.
 *
 * This module is pure: no I/O, no global state.
 */

import { severityWeight } from './severity.js';
import type { Finding, Grade, ScoreBreakdown, Severity } from './types.js';

/** Perfect score: no conformance findings. */
export const MAX_SCORE = 100;

/** Floor: the score never drops below zero no matter the penalty. */
export const MIN_SCORE = 0;

/**
 * Maximum node count that contributes per finding. Without a cap, a
 * single site-wide rule repeated hundreds of times would zero the
 * whole score and drown out every other finding.
 */
export const NODE_IMPACT_CAP = 10;

const GRADE_BANDS: ReadonlyArray<readonly [number, Grade]> = [
  [90, 'A'],
  [80, 'B'],
  [70, 'C'],
  [60, 'D'],
];

const EMPTY_COUNTS: Record<Severity, number> = {
  critical: 0,
  serious: 0,
  moderate: 0,
  minor: 0,
};

/** Penalty contributed by a single finding. */
export function findingPenalty(finding: Finding): number {
  return (
    severityWeight(finding.severity) *
    Math.min(finding.nodeCount, NODE_IMPACT_CAP)
  );
}

/** Maps a numeric score to its letter grade. */
export function gradeForScore(score: number): Grade {
  for (const [threshold, grade] of GRADE_BANDS) {
    if (score >= threshold) {
      return grade;
    }
  }

  return 'F';
}

export interface ScoredResult {
  readonly score: number;
  readonly grade: Grade;
  readonly breakdown: ScoreBreakdown;
}

/**
 * Scores a finding list. Best-practice findings are counted in
 * `breakdown.bestPracticeFindings` and excluded from the penalty.
 */
export function scoreFindings(findings: readonly Finding[]): ScoredResult {
  const countsBySeverity: Record<Severity, number> = { ...EMPTY_COUNTS };
  let totalPenalty = 0;
  let scoredFindings = 0;
  let bestPracticeFindings = 0;

  for (const finding of findings) {
    if (finding.wcag.isBestPractice) {
      bestPracticeFindings += 1;
      continue;
    }

    scoredFindings += 1;
    countsBySeverity[finding.severity] += 1;
    totalPenalty += findingPenalty(finding);
  }

  const score = Math.max(MIN_SCORE, MAX_SCORE - totalPenalty);

  return {
    score,
    grade: gradeForScore(score),
    breakdown: {
      totalPenalty,
      countsBySeverity,
      scoredFindings,
      bestPracticeFindings,
    },
  };
}
