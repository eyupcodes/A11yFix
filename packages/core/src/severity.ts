/**
 * Severity classification for axe findings.
 *
 * Axe reports `impact` per rule, but the value can be `null` or absent —
 * incomplete results regularly carry no impact. Classification therefore
 * never throws: unknown or missing impact falls back to `moderate` so
 * the finding survives instead of being silently dropped.
 *
 * This module is pure: no I/O, no global state.
 */

import type { Severity } from './types.js';

/** Numeric penalty weight per severity, used by the scorer. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 10,
  serious: 5,
  moderate: 2,
  minor: 1,
};

/** Axe `impact` values that map cleanly onto a severity. */
const KNOWN_IMPACTS: ReadonlySet<string> = new Set([
  'minor',
  'moderate',
  'serious',
  'critical',
]);

/** Severity used when axe reports no usable impact. */
export const DEFAULT_SEVERITY: Severity = 'moderate';

/**
 * Classifies an axe `impact` value into a severity.
 *
 * Accepts `unknown` because axe results cross a trust boundary (they
 * originate from page content) and are validated loosely upstream —
 * a non-string impact must degrade, not crash.
 */
export function classifySeverity(impact: unknown): Severity {
  if (typeof impact === 'string' && KNOWN_IMPACTS.has(impact)) {
    return impact as Severity;
  }

  return DEFAULT_SEVERITY;
}

/** Returns the scoring weight for a severity. */
export function severityWeight(severity: Severity): number {
  return SEVERITY_WEIGHTS[severity];
}
