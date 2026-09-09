/**
 * Input validation for reports before serialization and rendering.
 *
 * Ensures the incoming report satisfies the AccessibilityReport contract
 * from `@a11yfix/core` before processing.
 */

import type { AccessibilityReport, Grade } from '@a11yfix/core';

import { ReporterError } from './errors.js';

const VALID_GRADES = new Set<Grade>(['A', 'B', 'C', 'D', 'F']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface RawBreakdown {
  readonly totalPenalty?: unknown;
  readonly scoredFindings?: unknown;
  readonly bestPracticeFindings?: unknown;
  readonly countsBySeverity?: unknown;
}

interface RawRuleCounts {
  readonly violations?: unknown;
  readonly passes?: unknown;
  readonly incomplete?: unknown;
  readonly inapplicable?: unknown;
}

interface RawReport {
  readonly findings?: unknown;
  readonly score?: unknown;
  readonly grade?: unknown;
  readonly breakdown?: unknown;
  readonly ruleCounts?: unknown;
  readonly meta?: unknown;
}

/**
 * Validates that an untrusted value conforms to the AccessibilityReport contract.
 *
 * @throws {ReporterError} with code `INVALID_REPORT` if the value is malformed.
 */
export function validateReport(
  report: unknown,
): asserts report is AccessibilityReport {
  if (!isObject(report)) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report input must be a non-null object.',
    );
  }

  const candidate = report as RawReport;

  if (!Array.isArray(candidate.findings)) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report findings must be an array.',
    );
  }

  if (
    typeof candidate.score !== 'number' ||
    Number.isNaN(candidate.score) ||
    candidate.score < 0 ||
    candidate.score > 100
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report score must be a number between 0 and 100.',
    );
  }

  if (
    typeof candidate.grade !== 'string' ||
    !VALID_GRADES.has(candidate.grade as Grade)
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report grade must be one of A, B, C, D, or F.',
    );
  }

  if (!isObject(candidate.breakdown)) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report breakdown must be an object.',
    );
  }

  const breakdown = candidate.breakdown as RawBreakdown;
  if (
    typeof breakdown.totalPenalty !== 'number' ||
    typeof breakdown.scoredFindings !== 'number' ||
    typeof breakdown.bestPracticeFindings !== 'number' ||
    !isObject(breakdown.countsBySeverity)
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report breakdown is missing required numeric counts or countsBySeverity.',
    );
  }

  if (!isObject(candidate.ruleCounts)) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report ruleCounts must be an object.',
    );
  }

  const ruleCounts = candidate.ruleCounts as RawRuleCounts;
  if (
    typeof ruleCounts.violations !== 'number' ||
    typeof ruleCounts.passes !== 'number' ||
    typeof ruleCounts.incomplete !== 'number' ||
    typeof ruleCounts.inapplicable !== 'number'
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Report ruleCounts must contain violations, passes, incomplete, and inapplicable counts.',
    );
  }

  if (!isObject(candidate.meta)) {
    throw new ReporterError('INVALID_REPORT', 'Report meta must be an object.');
  }
}

/**
 * Validates that a value conforms to the MultiPageReport contract.
 *
 * @throws {ReporterError} with code `INVALID_REPORT` if malformed.
 */
export function validateMultiPageReport(
  report: unknown,
): asserts report is import('@a11yfix/core').MultiPageReport {
  if (!isObject(report)) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Multi-page report must be a non-null object.',
    );
  }

  const candidate = report;

  if (!isObject(candidate['summary'])) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Multi-page report summary must be an object.',
    );
  }

  if (!Array.isArray(candidate['pages'])) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Multi-page report pages must be an array.',
    );
  }

  if (!Array.isArray(candidate['commonViolations'])) {
    throw new ReporterError(
      'INVALID_REPORT',
      'Multi-page report commonViolations must be an array.',
    );
  }
}
