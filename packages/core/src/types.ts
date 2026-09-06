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
