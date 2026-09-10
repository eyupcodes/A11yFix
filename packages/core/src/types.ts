/**
 * Public data model for `@a11yfix/core`.
 *
 * These types are the cross-package contract: the scanner produces raw
 * axe-core output, core turns it into this model, and the reporter (M4) and
 * CLI (M5) consume it. The model is immutable — every collection is
 * `readonly` and nothing here is ever mutated after construction.
 */

/** Failure severity, derived from the axe `impact` value. */
export type Severity = 'minor' | 'moderate' | 'serious' | 'critical';

/** Numeric ordering rank for a severity, highest first. */
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

/** WCAG conformance level. */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/** WCAG major version a rule maps to. */
export type WcagVersion = '2.0' | '2.1' | '2.2';

/**
 * A single WCAG success criterion in dotted form, e.g. `'1.1.1'`
 * (non-text content) or `'1.4.12'` (text spacing).
 */
export type WcagCriterion = string;

/** WCAG mapping extracted from a rule's tag list. */
export interface WcagMapping {
  /** Success criteria in dotted form, numerically ordered and de-duplicated. */
  readonly criteria: readonly WcagCriterion[];
  /** Highest applicable conformance level, or null when none was present. */
  readonly level: WcagLevel | null;
  /** WCAG version associated with the selected level. */
  readonly version: WcagVersion | null;
  /** True when the rule carries axe-core's `best-practice` tag. */
  readonly isBestPractice: boolean;
}

/** One affected element within a finding. */
export interface FindingNode {
  /** Outer HTML of the affected element. */
  readonly html: string;
  /**
   * Flattened CSS selector path to the element. Nested axe targets
   * (shadow DOM, frames) are flattened depth-first; empty when the
   * raw target carried no usable selector.
   */
  readonly target: readonly string[];
  /** Axe failure summary for this node, or null when axe gave none. */
  readonly failureSummary: string | null;
}

/** Actionable remediation guidance for a finding. */
export interface Remediation {
  /** Short human-readable summary, taken from the axe rule `help` text. */
  readonly summary: string;
  /** First-node failure detail, or null when no node carried one. */
  readonly details: string | null;
  /** Deque University URL documenting the rule. */
  readonly helpUrl: string;
}

/** A single normalized accessibility finding. */
export interface Finding {
  /** Stable axe rule id, e.g. `'image-alt'`. */
  readonly ruleId: string;
  /** Classified severity; never undefined — see `severity.ts`. */
  readonly severity: Severity;
  /** WCAG mapping extracted from the rule tags. */
  readonly wcag: WcagMapping;
  /** Rule description from axe-core. */
  readonly description: string;
  /** Rule help text from axe-core. */
  readonly help: string;
  /** Affected elements. */
  readonly nodes: readonly FindingNode[];
  /** `nodes.length`, kept alongside for sorting and scoring. */
  readonly nodeCount: number;
  /** Remediation guidance. */
  readonly remediation: Remediation;
}

/** Counts of scored findings per severity plus the total penalty. */
export interface ScoreBreakdown {
  readonly totalPenalty: number;
  readonly countsBySeverity: Readonly<Record<Severity, number>>;
  /** Conformance findings that contributed to the score. */
  readonly scoredFindings: number;
  /** Best-practice findings, excluded from the conformance score. */
  readonly bestPracticeFindings: number;
}

/** Letter grade derived from the numeric score. */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** Raw axe result-group sizes, so nothing the scanner saw is lost. */
export interface RuleCounts {
  readonly violations: number;
  readonly passes: number;
  readonly incomplete: number;
  readonly inapplicable: number;
}

/** Optional scan metadata carried through from the scanner result. */
export interface ScanMeta {
  readonly requestedUrl: string | null;
  readonly finalUrl: string | null;
  readonly title: string | null;
  readonly scannedAt: string | null;
}

/** The complete output of `analyzeAxeResults`. */
export interface AccessibilityReport {
  /** Normalized findings, deterministically ordered. */
  readonly findings: readonly Finding[];
  /** Conformance score, 0–100. */
  readonly score: number;
  /** Letter grade for the score. */
  readonly grade: Grade;
  /** Explainable scoring detail for the reporter. */
  readonly breakdown: ScoreBreakdown;
  /** Raw axe result-group sizes. */
  readonly ruleCounts: RuleCounts;
  /** Scan metadata, null when the caller did not supply it. */
  readonly meta: ScanMeta;
}

/** An individual page outcome within a multi-page crawl report. */
export interface MultiPageItem {
  readonly url: string;
  readonly depth: number;
  readonly report: AccessibilityReport | null;
  readonly error: string | null;
}

/** Aggregated violation recurring across one or more pages in a crawl. */
export interface CommonViolation {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly description: string;
  readonly help: string;
  readonly wcag: WcagMapping;
  readonly remediation: Remediation;
  /** Number of distinct pages where this violation occurred. */
  readonly occurrenceCount: number;
  /** URLs of pages where this violation occurred. */
  readonly pageUrls: readonly string[];
  /** Total affected DOM elements across all crawled pages. */
  readonly totalNodes: number;
  /** True when violation occurs on multiple pages or >= 50% of audited pages. */
  readonly isSiteWide: boolean;
}

/** Summary metrics for an entire multi-page site crawl. */
export interface MultiPageSummary {
  readonly seedUrl: string;
  readonly totalPages: number;
  readonly successfulPages: number;
  readonly failedPages: number;
  readonly siteScore: number;
  readonly siteGrade: Grade;
  readonly totalViolations: number;
  readonly totalPasses: number;
  readonly countsBySeverity: Readonly<Record<Severity, number>>;
  readonly durationMs: number;
  readonly scannedAt: string;
}

/** The complete output of multi-page crawling analysis. */
export interface MultiPageReport {
  readonly summary: MultiPageSummary;
  readonly pages: readonly MultiPageItem[];
  readonly commonViolations: readonly CommonViolation[];
}

/** Input contract representing a scanned page for core analysis. */
export interface CrawlInputPage {
  readonly url: string;
  readonly depth: number;
  readonly scanResult?:
    | {
        readonly requestedUrl: string;
        readonly finalUrl: string;
        readonly title: string;
        readonly scannedAt: string;
        readonly durationMs: number;
        readonly axe: unknown;
      }
    | undefined;
  readonly error?: string | undefined;
}

/** Input contract representing a crawl result for core analysis. */
export interface CrawlInput {
  readonly seedUrl: string;
  readonly pages: readonly CrawlInputPage[];
  readonly durationMs?: number | undefined;
  readonly startedAt?: string | undefined;
}

/** Regression and progress status between baseline and current audit. */
export type DiffStatus = 'REGRESSED' | 'IMPROVED' | 'UNCHANGED' | 'MIXED';

/** Representation of an individual violation occurrence in a diff. */
export interface DiffViolation {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly help: string;
  readonly description: string;
  readonly target: readonly string[];
  readonly html: string;
  readonly failureSummary: string | null;
  readonly helpUrl?: string;
  readonly pageUrl?: string;
}

/** Rule-level delta summary between baseline and current audit. */
export interface RuleDiffSummary {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly help: string;
  readonly baselineCount: number;
  readonly currentCount: number;
  readonly delta: number;
}

/** Diff summary metrics across all findings. */
export interface DiffCounts {
  readonly baselineTotal: number;
  readonly currentTotal: number;
  readonly newCount: number;
  readonly fixedCount: number;
  readonly persistentCount: number;
}

/** Diff result comparing two AccessibilityReport instances. */
export interface SingleReportDiff {
  readonly kind: 'single';
  readonly baselineScore: number;
  readonly currentScore: number;
  readonly scoreDelta: number;
  readonly baselineGrade: Grade;
  readonly currentGrade: Grade;
  readonly status: DiffStatus;
  readonly newViolations: readonly DiffViolation[];
  readonly fixedViolations: readonly DiffViolation[];
  readonly persistentViolations: readonly DiffViolation[];
  readonly rulesSummary: readonly RuleDiffSummary[];
  readonly counts: DiffCounts;
}

/** Page-level diff outcome in a multi-page crawl comparison. */
export interface PageDiffItem {
  readonly url: string;
  readonly status:
    | 'NEW_PAGE'
    | 'REMOVED_PAGE'
    | 'REGRESSED'
    | 'IMPROVED'
    | 'UNCHANGED'
    | 'MIXED';
  readonly baselineScore: number | null;
  readonly currentScore: number | null;
  readonly scoreDelta: number | null;
  readonly newCount: number;
  readonly fixedCount: number;
  readonly persistentCount: number;
}

/** Diff result comparing two MultiPageReport instances. */
export interface MultiPageReportDiff {
  readonly kind: 'multi-page';
  readonly baselineSiteScore: number;
  readonly currentSiteScore: number;
  readonly scoreDelta: number;
  readonly baselineGrade: Grade;
  readonly currentGrade: Grade;
  readonly status: DiffStatus;
  readonly newViolations: readonly DiffViolation[];
  readonly fixedViolations: readonly DiffViolation[];
  readonly persistentViolations: readonly DiffViolation[];
  readonly pages: readonly PageDiffItem[];
  readonly counts: DiffCounts;
}

/** Discriminated union of single-page or multi-page report diff results. */
export type ReportDiff = SingleReportDiff | MultiPageReportDiff;

/** Supported frontend target frameworks for remediation code generation. */
export type RemediationFramework = 'html' | 'react' | 'vue' | 'svelte';

/** Confidence rating for a generated remediation patch. */
export type RemediationConfidence = 'high' | 'medium' | 'low';

/** Code patch proposing a fix for an accessibility violation node. */
export interface RemediationPatch {
  readonly ruleId: string;
  readonly target: readonly string[];
  readonly originalHtml: string;
  readonly fixedCode: string;
  readonly explanation: string;
  readonly framework: RemediationFramework;
  readonly confidence: RemediationConfidence;
  readonly changes: readonly string[];
  readonly diff: string;
}

/** Remediation patches associated with a specific rule violation. */
export interface RuleRemediationResult {
  readonly ruleId: string;
  readonly description: string;
  readonly helpUrl: string;
  readonly patches: readonly RemediationPatch[];
}

/** Complete remediation plan across an audit report. */
export interface ReportRemediationPlan {
  readonly totalViolations: number;
  readonly remediatedCount: number;
  readonly framework: RemediationFramework;
  readonly provider: string;
  readonly results: readonly RuleRemediationResult[];
  readonly generatedAt: string;
}

/** Configuration options for generating remediation code patches. */
export interface RemediationOptions {
  readonly framework?: RemediationFramework | undefined;
  readonly provider?:
    'heuristic' | 'openai' | 'anthropic' | 'custom' | undefined;
  readonly apiKey?: string | undefined;
  readonly endpoint?: string | undefined;
  readonly model?: string | undefined;
}
