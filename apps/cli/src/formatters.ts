/**
 * Terminal output formatters for CLI reports and error messages.
 */

import type {
  AccessibilityReport,
  DiffViolation,
  Finding,
  ReportDiff,
} from '@a11yfix/core';

export interface FormatSummaryOptions {
  readonly threshold?: number | undefined;
}

export interface FormatDiffSummaryOptions {
  readonly failOnRegression?: boolean | undefined;
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
 * Formats a MultiPageReport into a human-readable terminal summary string.
 */
export function formatCrawlTerminalSummary(
  report: import('@a11yfix/core').MultiPageReport,
  options?: FormatSummaryOptions,
): string {
  const sep = '='.repeat(60);
  const sum = report.summary;

  const lines: string[] = [
    sep,
    'A11yFix Site Accessibility Crawl Report',
    sep,
    `Seed URL:      ${sum.seedUrl}`,
    `Pages:         ${sum.totalPages} scanned, ${sum.successfulPages} successful, ${sum.failedPages} failed`,
    `Site Score:    ${sum.siteScore}/100 (Grade ${sum.siteGrade})`,
    `Violations:    ${sum.totalViolations} &bull; Passes: ${sum.totalPasses} &bull; Duration: ${sum.durationMs} ms`,
    '-'.repeat(60),
    'Severity Breakdown:',
    `  Critical:   ${sum.countsBySeverity.critical}`,
    `  Serious:    ${sum.countsBySeverity.serious}`,
    `  Moderate:   ${sum.countsBySeverity.moderate}`,
    `  Minor:      ${sum.countsBySeverity.minor}`,
    '-'.repeat(60),
  ];

  if (report.commonViolations.length > 0) {
    lines.push(`Recurring Violations (${report.commonViolations.length}):`);
    for (const v of report.commonViolations) {
      const siteWide = v.isSiteWide ? ' [Site-wide]' : '';
      lines.push(
        `  • [${v.severity.toUpperCase()}] ${v.ruleId}${siteWide} — ${v.occurrenceCount} pages, ${v.totalNodes} nodes`,
      );
    }
    lines.push('-'.repeat(60));
  }

  lines.push('Per-Page Breakdown:');
  for (const page of report.pages) {
    const pageScore = page.report
      ? `${page.report.score}/100 ${page.report.grade}`
      : 'Failed';
    lines.push(
      `  depth:${page.depth}  ${page.url}  —  ${pageScore}${page.error ? ` (${page.error})` : ''}`,
    );
  }

  if (options?.threshold !== undefined) {
    lines.push('-'.repeat(60));
    if (sum.siteScore >= options.threshold) {
      lines.push(
        `✔ PASS: Site score ${sum.siteScore} meets threshold ${options.threshold}`,
      );
    } else {
      lines.push(
        `✖ FAIL: Site score ${sum.siteScore} is below threshold ${options.threshold}`,
      );
    }
  }

  lines.push(sep);
  return lines.join('\n');
}

function formatDiffViolation(v: DiffViolation, index: number): string {
  const targetStr = v.target.length > 0 ? ` [${v.target.join(' ')}]` : '';
  const pageStr = v.pageUrl ? ` (page: ${v.pageUrl})` : '';
  const lines = [
    `  ${index + 1}. [${v.severity.toUpperCase()}] ${v.ruleId}${targetStr}${pageStr}`,
    `     ${v.description}`,
  ];
  if (v.failureSummary) {
    lines.push(`     Issue: ${v.failureSummary}`);
  }
  if (v.html) {
    const snippet = v.html.length > 80 ? `${v.html.slice(0, 80)}...` : v.html;
    lines.push(`     Element: ${snippet}`);
  }
  if (v.helpUrl) {
    lines.push(`     Docs: ${v.helpUrl}`);
  }
  return lines.join('\n');
}

/**
 * Formats a ReportDiff into a human-readable terminal regression summary string.
 */
export function formatDiffTerminalSummary(
  diff: ReportDiff,
  options?: FormatDiffSummaryOptions,
): string {
  const separator = '='.repeat(60);
  const subSeparator = '-'.repeat(60);

  const baselineScore =
    diff.kind === 'single' ? diff.baselineScore : diff.baselineSiteScore;
  const currentScore =
    diff.kind === 'single' ? diff.currentScore : diff.currentSiteScore;
  const deltaStr =
    diff.scoreDelta > 0 ? `+${diff.scoreDelta}` : `${diff.scoreDelta}`;

  const lines: string[] = [
    separator,
    'A11yFix Accessibility Regression Diff Report',
    separator,
    `Status:      ${diff.status}`,
    `Score:       ${baselineScore} (${diff.baselineGrade}) → ${currentScore} (${diff.currentGrade}) [${deltaStr}]`,
    subSeparator,
    'Violation Changes:',
    `  New Violations (Regressions): ${diff.counts.newCount}`,
    `  Resolved Violations:          ${diff.counts.fixedCount}`,
    `  Persistent Violations:        ${diff.counts.persistentCount}`,
  ];

  if (diff.kind === 'multi-page') {
    lines.push(subSeparator);
    lines.push(`Pages Audited: ${diff.pages.length}`);
    for (const p of diff.pages) {
      const pBase = p.baselineScore !== null ? `${p.baselineScore}` : '—';
      const pCur = p.currentScore !== null ? `${p.currentScore}` : '—';
      const pDelta =
        p.scoreDelta !== null
          ? p.scoreDelta > 0
            ? `+${p.scoreDelta}`
            : `${p.scoreDelta}`
          : '—';
      lines.push(
        `  • ${p.url} [${p.status}] Score: ${pBase} → ${pCur} (${pDelta}) | New: ${p.newCount}, Fixed: ${p.fixedCount}`,
      );
    }
  }

  if (diff.newViolations.length > 0) {
    lines.push(subSeparator);
    lines.push(
      `✖ Regressions / New Violations (${diff.newViolations.length}):`,
    );
    for (let i = 0; i < diff.newViolations.length; i++) {
      const v = diff.newViolations[i];
      if (v) {
        lines.push(formatDiffViolation(v, i));
      }
    }
  } else {
    lines.push(subSeparator);
    lines.push('✔ No new regressions detected.');
  }

  if (diff.fixedViolations.length > 0) {
    lines.push(subSeparator);
    lines.push(`✔ Resolved Violations (${diff.fixedViolations.length}):`);
    for (let i = 0; i < diff.fixedViolations.length; i++) {
      const v = diff.fixedViolations[i];
      if (v) {
        const targetStr = v.target.length > 0 ? ` [${v.target.join(' ')}]` : '';
        lines.push(
          `  ${i + 1}. [${v.severity.toUpperCase()}] ${v.ruleId}${targetStr}`,
        );
      }
    }
  }

  if (options?.failOnRegression) {
    lines.push(subSeparator);
    if (diff.newViolations.length > 0) {
      lines.push(
        `✖ REGRESSION GATE FAILED: ${diff.newViolations.length} new accessibility violation(s) detected.`,
      );
    } else {
      lines.push(
        '✔ REGRESSION GATE PASSED: Zero new accessibility violations introduced.',
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
