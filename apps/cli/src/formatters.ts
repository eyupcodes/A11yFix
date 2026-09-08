/**
 * Terminal output formatters for CLI reports and error messages.
 */

import type { AccessibilityReport, Finding } from '@a11yfix/core';

export interface FormatSummaryOptions {
  readonly threshold?: number | undefined;
}

function formatFinding(finding: Finding, index: number): string {
  const wcagLevel = finding.wcag.level
    ? `WCAG ${finding.wcag.version ?? '2.1'} ${finding.wcag.level}`
    : null;
  const wcagCriteria = finding.wcag.criteria.join(', ');
  const wcagParts = [wcagLevel, wcagCriteria].filter(Boolean).join(': ');
  const wcagBadge = wcagParts ? ` (${wcagParts})` : '';
  const bpBadge = finding.wcag.isBestPractice ? ' [Best Practice]' : '';

  const lines = [
    `  ${index + 1}. [${finding.severity.toUpperCase()}] ${finding.ruleId}${wcagBadge}${bpBadge}`,
    `     ${finding.description}`,
    `     Affected elements: ${finding.nodeCount}`,
    `     Remediation: ${finding.remediation.summary}`,
  ];

  if (finding.remediation.helpUrl) {
    lines.push(`     Docs: ${finding.remediation.helpUrl}`);
  }

  return lines.join('\n');
}

/**
 * Formats an AccessibilityReport into a human-readable terminal summary string.
 */
export function formatTerminalSummary(
  report: AccessibilityReport,
  options?: FormatSummaryOptions,
): string {
  const separator = '='.repeat(60);
  const subSeparator = '-'.repeat(60);

  const lines: string[] = [
    separator,
    'A11yFix Accessibility Audit Report',
    separator,
  ];

  if (report.meta.requestedUrl) {
    lines.push(`URL:         ${report.meta.requestedUrl}`);
  }
  if (report.meta.title) {
    lines.push(`Title:       ${report.meta.title}`);
  }
  if (report.meta.scannedAt) {
    lines.push(`Scanned At:  ${report.meta.scannedAt}`);
  }

  lines.push(`Score:       ${report.score}/100 (Grade ${report.grade})`);
  lines.push(subSeparator);

  const { countsBySeverity, bestPracticeFindings } = report.breakdown;
  lines.push('Severity Breakdown:');
  lines.push(`  Critical:      ${countsBySeverity.critical}`);
  lines.push(`  Serious:       ${countsBySeverity.serious}`);
  lines.push(`  Moderate:      ${countsBySeverity.moderate}`);
  lines.push(`  Minor:         ${countsBySeverity.minor}`);
  if (bestPracticeFindings > 0) {
    lines.push(`  Best Practice: ${bestPracticeFindings}`);
  }

  lines.push(subSeparator);

  if (report.findings.length === 0) {
    lines.push('✔ Clean scan! No accessibility violations detected.');
  } else {
    lines.push(`Violations (${report.findings.length}):`);
    for (let i = 0; i < report.findings.length; i++) {
      const finding = report.findings[i];
      if (finding) {
        lines.push(formatFinding(finding, i));
      }
    }
  }

  if (options?.threshold !== undefined) {
    lines.push(subSeparator);
    if (report.score >= options.threshold) {
      lines.push(
        `✔ PASS: Score ${report.score} meets threshold ${options.threshold}`,
      );
    } else {
      lines.push(
        `✖ FAIL: Score ${report.score} is below threshold ${options.threshold}`,
      );
    }
  }

  lines.push(separator);
  return lines.join('\n');
}

/**
 * Formats any thrown error into a clean, actionable message for stderr.
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    const code =
      'code' in error && typeof error.code === 'string'
        ? ` [${error.code}]`
        : '';
    return `Error${code}: ${error.message}`;
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    const code =
      typeof candidate.code === 'string' ? ` [${candidate.code}]` : '';
    const message =
      typeof candidate.message === 'string'
        ? candidate.message
        : JSON.stringify(error);
    return `Error${code}: ${message}`;
  }

  return `Error: ${String(error)}`;
}
