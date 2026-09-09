/**
 * JSON serialization for multi-page crawl reports.
 */

import type { MultiPageReport } from '@a11yfix/core';

import type { JsonReportOptions } from './types.js';
import { validateMultiPageReport } from './validate.js';

/**
 * Serializes a MultiPageReport into a JSON string.
 *
 * @throws {ReporterError} if the input is not a valid MultiPageReport.
 */
export function renderMultiPageJsonReport(
  report: MultiPageReport,
  options?: JsonReportOptions,
): string {
  validateMultiPageReport(report);

  const space = options?.pretty ? 2 : undefined;
  return JSON.stringify(report, null, space);
}
