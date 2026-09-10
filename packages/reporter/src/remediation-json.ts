/**
 * JSON remediation report serializer.
 *
 * Formats a ReportRemediationPlan into a JSON string with optional indentation.
 */

import type { ReportRemediationPlan } from '@a11yfix/core';

import { ReporterError } from './errors.js';
import type { JsonReportOptions } from './types.js';

export function renderRemediationJsonReport(
  plan: ReportRemediationPlan,
  options?: JsonReportOptions,
): string {
  if (
    typeof plan !== 'object' ||
    plan === null ||
    !('results' in plan) ||
    !('framework' in plan) ||
    !Array.isArray(plan.results)
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'The provided plan object is not a valid ReportRemediationPlan.',
    );
  }

  return options?.pretty ? JSON.stringify(plan, null, 2) : JSON.stringify(plan);
}
