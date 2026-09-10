/**
 * JSON diff report serializer.
 *
 * Formats a ReportDiff into a JSON string with optional indentation.
 */

import type { ReportDiff } from '@a11yfix/core';

import { ReporterError } from './errors.js';
import type { JsonReportOptions } from './types.js';

export function renderDiffJsonReport(
  diff: ReportDiff,
  options?: JsonReportOptions,
): string {
  if (
    typeof diff !== 'object' ||
    diff === null ||
    !('status' in diff) ||
    !('counts' in diff) ||
    !('newViolations' in diff)
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'The provided diff object is not a valid ReportDiff.',
    );
  }

  return options?.pretty ? JSON.stringify(diff, null, 2) : JSON.stringify(diff);
}
