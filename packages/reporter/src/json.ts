/**
 * JSON serialization for accessibility reports.
 *
 * Converts a validated `AccessibilityReport` to a standardized JSON string,
 * with optional indentation for human readability.
 */

import type { AccessibilityReport } from '@a11yfix/core';

import type { JsonReportOptions } from './types.js';
import { validateReport } from './validate.js';

/**
 * Serializes an AccessibilityReport into a JSON string.
 *
 * @throws {ReporterError} if the input is not a valid AccessibilityReport.
 */
export function renderJsonReport(
  report: AccessibilityReport,
  options?: JsonReportOptions,
): string {
  validateReport(report);

  const space = options?.pretty ? 2 : undefined;
  return JSON.stringify(report, null, space);
}
