/**
 * Accessible HTML report renderer.
 *
 * Generates a standalone, self-contained, responsive HTML5 document from a
 * validated `AccessibilityReport`. All untrusted data is strictly escaped.
 */

import type {
  AccessibilityReport,
  Finding,
  FindingNode,
  Grade,
  ScanMeta,
  Severity,
} from '@a11yfix/core';

import { escapeAttribute, escapeHtml } from './escape.js';
import type { HtmlReportOptions } from './types.js';
import { validateReport } from './validate.js';

const SEVERITY_COLORS: Record<
  Severity,
  { bg: string; text: string; border: string }
> = {
  critical: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
  serious: { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  moderate: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  minor: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
};

const GRADE_COLORS: Record<Grade, { bg: string; text: string }> = {
  A: { bg: '#15803d', text: '#ffffff' },
  B: { bg: '#0369a1', text: '#ffffff' },
  C: { bg: '#b45309', text: '#ffffff' },
  D: { bg: '#c2410c', text: '#ffffff' },
  F: { bg: '#b91c1c', text: '#ffffff' },
};

function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  return /^https?:\/\//i.test(url.trim());
}

function renderMeta(meta: ScanMeta): string {
  const items: string[] = [];

  if (meta.requestedUrl !== null) {
    const urlContent = isSafeUrl(meta.requestedUrl)
      ? `<a href="${escapeAttribute(meta.requestedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(meta.requestedUrl)}</a>`
      : escapeHtml(meta.requestedUrl);
    items.push(`<div><strong>URL:</strong> ${urlContent}</div>`);
  }
  if (meta.title !== null) {
    items.push(
      `<div><strong>Page Title:</strong> ${escapeHtml(meta.title)}</div>`,
    );
  }
  if (meta.scannedAt !== null) {
    items.push(
      `<div><strong>Scanned At:</strong> <time datetime="${escapeAttribute(meta.scannedAt)}">${escapeHtml(meta.scannedAt)}</time></div>`,
    );
  }

  if (items.length === 0) {
    return '';
  }

  return `<div class="meta-card">${items.join('\n')}</div>`;
}

function renderScoreBadge(score: number, grade: Grade): string {
  const color = GRADE_COLORS[grade];
  return `
    <div class="score-card" style="border-color: ${color.bg};">
      <div class="score-number">${score}</div>
      <div class="score-grade" style="background: ${color.bg}; color: ${color.text};">Grade ${grade}</div>
      <div class="score-label">Accessibility Score</div>
    </div>
  `;
}

function renderSummaryCards(report: AccessibilityReport): string {
  const { breakdown, ruleCounts } = report;
  const severities: Severity[] = ['critical', 'serious', 'moderate', 'minor'];

  const severityPills = severities
    .map((sev) => {
      const count = breakdown.countsBySeverity[sev];
      const theme = SEVERITY_COLORS[sev];
      return `
        <div class="metric-pill" style="background: ${theme.bg}; color: ${theme.text}; border-color: ${theme.border};">
          <span class="pill-count">${count}</span>
          <span class="pill-label">${sev}</span>
        </div>
      `;
    })
    .join('');

  return `
    <section class="summary-section" aria-labelledby="summary-heading">
      <h2 id="summary-heading" class="sr-only">Audit Summary</h2>
      <div class="metrics-grid">
        ${severityPills}
      </div>
      <div class="rules-summary">
        <span>Evaluated ${ruleCounts.violations + ruleCounts.passes + ruleCounts.incomplete + ruleCounts.inapplicable} rules</span>
        <span>&bull;</span>
        <span>${ruleCounts.passes} passed</span>
        <span>&bull;</span>
        <span>${ruleCounts.incomplete} incomplete</span>
        <span>&bull;</span>
        <span>${breakdown.bestPracticeFindings} best practice</span>
      </div>
    </section>
  `;
}

function renderNode(node: FindingNode, index: number): string {
  const targetSelector = node.target.join(' > ');
  const failureHtml = node.failureSummary
    ? `<div class="failure-summary">${escapeHtml(node.failureSummary)}</div>`
    : '';

  return `
    <li class="node-item">
      <div class="node-header">Element #${index + 1}: <code>${escapeHtml(targetSelector || '(no selector)')}</code></div>
      ${failureHtml}
      <pre class="node-code"><code>${escapeHtml(node.html)}</code></pre>
    </li>
  `;
}

function renderFinding(finding: Finding): string {
  const theme = SEVERITY_COLORS[finding.severity];
  const wcagLevel = finding.wcag.level
    ? `<span class="badge badge-wcag">WCAG ${escapeHtml(finding.wcag.version ?? '2.1')} ${escapeHtml(finding.wcag.level)}</span>`
    : '';
  const wcagCriteria = finding.wcag.criteria
    .map((c) => `<span class="badge badge-criterion">${escapeHtml(c)}</span>`)
    .join(' ');
  const bestPracticeBadge = finding.wcag.isBestPractice
    ? `<span class="badge badge-bp">Best Practice</span>`
    : '';

  const nodesHtml = finding.nodes.map(renderNode).join('');

  return `
    <article class="finding-card" style="border-left-color: ${theme.border};">
      <header class="finding-header">
        <div class="finding-title-row">
          <h3 class="finding-title">${escapeHtml(finding.ruleId)}</h3>
          <span class="badge badge-severity" style="background: ${theme.bg}; color: ${theme.text}; border: 1px solid ${theme.border};">${escapeHtml(finding.severity)}</span>
          ${wcagLevel}
          ${wcagCriteria}
          ${bestPracticeBadge}
        </div>
        <p class="finding-desc">${escapeHtml(finding.description)}</p>
      </header>

      <div class="remediation-box">
        <strong>Remediation:</strong> ${escapeHtml(finding.remediation.summary)}
        ${isSafeUrl(finding.remediation.helpUrl) ? ` — <a href="${escapeAttribute(finding.remediation.helpUrl)}" target="_blank" rel="noopener noreferrer">Learn more</a>` : ''}
      </div>

      <details class="nodes-details">
        <summary>Affected Elements (${finding.nodeCount})</summary>
        <ul class="nodes-list">
          ${nodesHtml}
        </ul>
      </details>
    </article>
  `;
}

function renderFindings(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return `
      <section class="clean-pass-card" aria-labelledby="clean-pass-heading">
        <h2 id="clean-pass-heading">Clean Scan!</h2>
        <p>No accessibility violations were detected on this page.</p>
      </section>
    `;
  }

  const items = findings.map(renderFinding).join('\n');
  return `
    <section class="findings-section" aria-labelledby="findings-heading">
      <h2 id="findings-heading">Violations (${findings.length})</h2>
      <div class="findings-list">
        ${items}
      </div>
    </section>
  `;
}

function getReportStyles(): string {
  return `
    :root {
      --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --text-muted: #475569;
      --border: #e2e8f0;
      --code-bg: #f1f5f9;
      --link: #0369a1;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b0f19;
        --surface: #1e293b;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --border: #334155;
        --code-bg: #0f172a;
        --link: #38bdf8;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header.report-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .header-info h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
    .meta-card { color: var(--text-muted); font-size: 0.9rem; }
    .meta-card a { color: var(--link); text-decoration: none; word-break: break-all; }
    .meta-card a:hover { text-decoration: underline; }
    .score-card {
      background: var(--surface);
      border: 3px solid;
      border-radius: 12px;
      padding: 1rem 1.5rem;
      text-align: center;
      min-width: 140px;
    }
    .score-number { font-size: 2.5rem; font-weight: 800; line-height: 1; }
    .score-grade { font-size: 0.85rem; font-weight: 700; border-radius: 999px; padding: 0.2rem 0.6rem; margin: 0.4rem 0; display: inline-block; }
    .score-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .summary-section { margin-bottom: 2rem; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 1rem; margin-bottom: 0.75rem; }
    .metric-pill {
      border: 1px solid;
      border-radius: 8px;
      padding: 0.75rem;
      text-align: center;
      display: flex;
      flex-direction: column;
    }
    .pill-count { font-size: 1.5rem; font-weight: 700; }
    .pill-label { font-size: 0.8rem; text-transform: capitalize; font-weight: 600; }
    .rules-summary { font-size: 0.85rem; color: var(--text-muted); display: flex; gap: 0.5rem; justify-content: center; }
    .clean-pass-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      text-align: center;
      color: #16a34a;
    }
    .clean-pass-card h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .clean-pass-card p { color: var(--text-muted); }
    .findings-section h2 { font-size: 1.35rem; margin-bottom: 1rem; }
    .findings-list { display: flex; flex-direction: column; gap: 1rem; }
    .finding-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-left-width: 6px;
      border-radius: 8px;
      padding: 1.25rem;
    }
    .finding-header { margin-bottom: 0.75rem; }
    .finding-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    .finding-title { font-size: 1.1rem; font-weight: 700; }
    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-wcag { background: #e0f2fe; color: #0369a1; }
    .badge-criterion { background: #f3e8ff; color: #6b21a8; }
    .badge-bp { background: #f1f5f9; color: #475569; }
    .finding-desc { color: var(--text-muted); font-size: 0.95rem; }
    .remediation-box {
      background: var(--code-bg);
      border-radius: 6px;
      padding: 0.75rem;
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
    }
    .remediation-box a { color: var(--link); text-decoration: none; font-weight: 600; }
    .remediation-box a:hover { text-decoration: underline; }
    .nodes-details summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--link);
      user-select: none;
    }
    .nodes-list { list-style: none; margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .node-item { background: var(--code-bg); border-radius: 6px; padding: 0.75rem; font-size: 0.85rem; }
    .node-header { font-weight: 600; margin-bottom: 0.25rem; }
    .node-header code { color: #d97706; font-family: monospace; word-break: break-all; }
    .failure-summary { color: #b91c1c; margin-bottom: 0.5rem; white-space: pre-wrap; font-family: monospace; font-size: 0.8rem; }
    .node-code {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.5rem;
      overflow-x: auto;
      font-family: monospace;
      font-size: 0.8rem;
    }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;
    }
  `;
}

/**
 * Renders an AccessibilityReport into a standalone, accessible HTML document.
 *
 * @throws {ReporterError} if the report is invalid.
 */
export function renderHtmlReport(
  report: AccessibilityReport,
  options?: HtmlReportOptions,
): string {
  validateReport(report);

  const documentTitle =
    options?.title ??
    report.meta.title ??
    report.meta.requestedUrl ??
    'Accessibility Audit Report';
  const escapedTitle = escapeHtml(documentTitle);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <style>${getReportStyles()}</style>
</head>
<body>
  <div class="container">
    <header class="report-header">
      <div class="header-info">
        <h1>${escapedTitle}</h1>
        ${renderMeta(report.meta)}
      </div>
      ${renderScoreBadge(report.score, report.grade)}
    </header>

    <main>
      ${renderSummaryCards(report)}
      ${renderFindings(report.findings)}
    </main>
  </div>
</body>
</html>`;
}
