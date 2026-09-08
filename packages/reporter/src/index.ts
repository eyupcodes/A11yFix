/**
 * @a11yfix/reporter
 *
 * Report generation and file export layer for A11yFix.
 * Produces serialized JSON and standalone, accessible HTML reports.
 */

export {
  REPORTER_ERROR_CODES,
  ReporterError,
  isReporterError,
} from './errors.js';
export type { ReporterErrorCode } from './errors.js';

export { escapeAttribute, escapeHtml } from './escape.js';
export { writeReport } from './export.js';
export { renderHtmlReport } from './html.js';
export { renderJsonReport } from './json.js';

export type {
  HtmlReportOptions,
  JsonReportOptions,
  ReportFormat,
  WriteReportOptions,
} from './types.js';
export { validateReport } from './validate.js';
