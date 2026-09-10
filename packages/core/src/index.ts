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
export { analyzeCrawlResults } from './multi-page.js';
export {
  compareMultiPageReports,
  compareReports,
  diffReports,
  isAccessibilityReport,
  isMultiPageReport,
} from './diff.js';
export { CORE_ERROR_CODES, CoreError, isCoreError } from './errors.js';
export type { CoreErrorCode } from './errors.js';
export { classifySeverity, severityWeight } from './severity.js';
export { extractWcag } from './wcag.js';
export { gradeForScore } from './scoring.js';
export { generateUnifiedDiff } from './remediation-diff.js';
export { generateHeuristicFix } from './remediation-heuristics.js';
export {
  AnthropicRemediationProvider,
  CustomRemediationProvider,
  HeuristicRemediationProvider,
  OpenAiRemediationProvider,
  getRemediationProvider,
} from './remediation-providers.js';
export type { RemediationProvider } from './remediation-providers.js';
export {
  generateRemediationPatch,
  generateReportRemediationPlan,
} from './remediation.js';
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
  MultiPageReport,
  MultiPageSummary,
  MultiPageItem,
  CommonViolation,
  CrawlInput,
  CrawlInputPage,
  DiffCounts,
  DiffStatus,
  DiffViolation,
  MultiPageReportDiff,
  PageDiffItem,
  ReportDiff,
  RuleDiffSummary,
  SingleReportDiff,
  RemediationConfidence,
  RemediationFramework,
  RemediationOptions,
  RemediationPatch,
  ReportRemediationPlan,
  RuleRemediationResult,
} from './types.js';
