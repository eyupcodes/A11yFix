/**
 * Finding normalization: validated axe results → stable `Finding[]`.
 *
 * Each violated rule becomes exactly one finding carrying its severity,
 * WCAG mapping, affected nodes, and remediation guidance. Output order
 * is deterministic (severity desc, node count desc, rule id asc) so
 * report diffs stay stable across runs.
 *
 * This module is pure: no I/O, no global state.
 */

import type {
  ValidatedAxeNode,
  ValidatedAxeResult,
  ValidatedAxeResults,
} from './schemas.js';
import { classifySeverity } from './severity.js';
import type { Finding, FindingNode, Severity } from './types.js';
import { SEVERITY_ORDER } from './types.js';
import { extractWcag } from './wcag.js';

/**
 * Flattens an axe node target into a selector path.
 *
 * Axe targets are arrays of entries where each entry is a plain CSS
 * selector or a nested shadow-DOM/frame path. Nested paths are
 * flattened depth-first; non-string entries (hostile input surviving
 * validation shape) are dropped. The result is empty when nothing
 * usable remained.
 */
export function flattenTarget(
  target: ValidatedAxeNode['target'],
): readonly string[] {
  const selectors: string[] = [];

  const visit = (entry: string | readonly string[]): void => {
    if (typeof entry === 'string') {
      selectors.push(entry);
      return;
    }

    for (const nested of entry) {
      visit(nested);
    }
  };

  for (const entry of target) {
    visit(entry);
  }

  return selectors;
}

function normalizeNode(node: ValidatedAxeNode): FindingNode {
  return {
    html: node.html,
    target: flattenTarget(node.target),
    failureSummary: node.failureSummary ?? null,
  };
}

function normalizeResult(result: ValidatedAxeResult): Finding {
  const nodes = result.nodes.map(normalizeNode);
  const severity: Severity = classifySeverity(result.impact);

  return {
    ruleId: result.id,
    severity,
    wcag: extractWcag(result.tags),
    description: result.description,
    help: result.help,
    nodes,
    nodeCount: nodes.length,
    remediation: {
      summary: result.help,
      details: nodes[0]?.failureSummary ?? null,
      helpUrl: result.helpUrl,
    },
  };
}

function compareFindings(a: Finding, b: Finding): number {
  const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (severityDiff !== 0) {
    return severityDiff;
  }

  const nodeDiff = b.nodeCount - a.nodeCount;
  if (nodeDiff !== 0) {
    return nodeDiff;
  }

  return a.ruleId.localeCompare(b.ruleId);
}

/**
 * Turns validated violations into deterministically ordered findings.
 *
 * Only violations become findings — passes, incomplete, and
 * inapplicable results are counted by the caller, never reported
 * as findings.
 */
export function normalizeFindings(
  results: ValidatedAxeResults,
): readonly Finding[] {
  return results.violations.map(normalizeResult).sort(compareFindings);
}
