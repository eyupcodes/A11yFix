/**
 * Public analysis entry point: untrusted axe results → report.
 *
 * The flow is linear and owns no global state:
 *
 * ```text
 * unknown axe output
 *  ↓  schemas.ts — parseAxeResults        (rejects anything unusable)
 * validated violations / passes / incomplete / inapplicable
 *  ↓  findings.ts — normalizeFindings     (severity, WCAG, remediation)
 * deterministically ordered findings
 *  ↓  scoring.ts — scoreFindings          (penalty, score, grade)
 * AccessibilityReport
 * ```
 *
 * Only this module and `index.ts` are public. Everything else is an
 * implementation detail importable only by path.
 */

import { CoreError } from './errors.js';
import { normalizeFindings } from './findings.js';
import { parseAxeResults } from './schemas.js';
import { scoreFindings } from './scoring.js';
import type { AccessibilityReport, RuleCounts, ScanMeta } from './types.js';

/** Scan metadata accepted from the scanner result or hand-built input. */
export interface AnalyzeMeta {
  readonly requestedUrl?: string;
  readonly finalUrl?: string;
  readonly title?: string;
  readonly scannedAt?: string;
}

function toMetaValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new CoreError(
      'INVALID_AXE_RESULTS',
      'Scan metadata fields must be strings.',
    );
  }

  return value;
}

function toMeta(meta: AnalyzeMeta = {}): ScanMeta {
  if (typeof meta !== 'object' || meta === null) {
    throw new CoreError(
      'INVALID_AXE_RESULTS',
      'Scan metadata must be an object.',
    );
  }

  return {
    requestedUrl: toMetaValue(meta.requestedUrl),
    finalUrl: toMetaValue(meta.finalUrl),
    title: toMetaValue(meta.title),
    scannedAt: toMetaValue(meta.scannedAt),
  };
}

/**
 * Analyzes axe-core results into a normalized, scored report.
 *
 * Accepts `unknown` because axe output crosses a trust boundary —
 * anything the page handed back must be validated, not trusted.
 * Scan metadata is optional and carried through verbatim.
 *
 * @throws {CoreError} with code `INVALID_AXE_RESULTS` when the
 * input is not a usable axe results object.
 */
export function analyzeAxeResults(
  results: unknown,
  meta?: AnalyzeMeta,
): AccessibilityReport {
  const validated = parseAxeResults(results);
  const findings = normalizeFindings(validated);
  const { score, grade, breakdown } = scoreFindings(findings);

  const ruleCounts: RuleCounts = {
    violations: validated.violations.length,
    passes: validated.passes.length,
    incomplete: validated.incomplete.length,
    inapplicable: validated.inapplicable.length,
  };

  return {
    findings,
    score,
    grade,
    breakdown,
    ruleCounts,
    meta: toMeta(meta),
  };
}
