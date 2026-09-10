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
export { renderDiffHtmlReport } from './diff-html.js';
export { renderDiffJsonReport } from './diff-json.js';
export { renderMultiPageHtmlReport } from './multi-page-html.js';
export { renderMultiPageJsonReport } from './multi-page-json.js';
export { buildSarifLog, renderSarifReport } from './sarif.js';
export type {
  SarifLocation,
  SarifLogicalLocation,
  SarifLog,
  SarifPhysicalLocation,
  SarifReportingDescriptor,
  SarifResult,
  SarifRun,
} from './sarif.js';

export type {
  DiffHtmlReportOptions,
  HtmlReportOptions,
  JsonReportOptions,
  ReportFormat,
  SarifReportOptions,
  WriteReportOptions,
} from './types.js';
export { validateMultiPageReport, validateReport } from './validate.js';
