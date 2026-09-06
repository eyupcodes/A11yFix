/**
 * `@a11yfix/core` public API.
 *
 * Core turns untrusted axe-core results into a normalized, WCAG-mapped,
 * severity-classified, scored report. It is pure — no browser, no I/O,
 * no rendering. `analyzeAxeResults` is the single entry point; the
 * reporter (M4) and CLI (M5) consume its output.
 */

export { analyzeAxeResults } from './normalize.js';
export type { AnalyzeMeta } from './normalize.js';
export { CORE_ERROR_CODES, CoreError, isCoreError } from './errors.js';
export type { CoreErrorCode } from './errors.js';
export { classifySeverity, severityWeight } from './severity.js';
export { extractWcag } from './wcag.js';
export type {
  AccessibilityReport,
  Finding,
  FindingNode,
  Grade,
  Remediation,
  RuleCounts,
  ScanMeta,
  ScoreBreakdown,
  Severity,
  WcagCriterion,
  WcagLevel,
  WcagMapping,
  WcagVersion,
} from './types.js';
