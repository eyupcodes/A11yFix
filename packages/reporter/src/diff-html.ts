/**
 * Accessible HTML diff report renderer.
 *
 * Generates a standalone, responsive, accessible HTML5 regression report
 * from a validated `ReportDiff`. All untrusted values are strictly escaped.
 */

import type {
  DiffStatus,
  DiffViolation,
  Grade,
  ReportDiff,
  Severity,
} from '@a11yfix/core';

import { escapeAttribute, escapeHtml } from './escape.js';
import { ReporterError } from './errors.js';
import type { DiffHtmlReportOptions } from './types.js';

const SEVERITY_COLORS: Record<
  Severity,
  { bg: string; text: string; border: string }
> = {
  critical: { bg: '#fee2e2', text: '#991b1b', border: '#f87171' },
  serious: { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' },
  moderate: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  minor: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
};

const STATUS_CONFIG: Record<
  DiffStatus,
  { label: string; bg: string; text: string }
> = {
  REGRESSED: { label: 'Regression Detected', bg: '#b91c1c', text: '#ffffff' },
  IMPROVED: { label: 'Accessibility Improved', bg: '#15803d', text: '#ffffff' },
  UNCHANGED: { label: 'No Changes', bg: '#475569', text: '#ffffff' },
  MIXED: { label: 'Mixed Changes', bg: '#b45309', text: '#ffffff' },
};

const GRADE_COLORS: Record<Grade, { bg: string; text: string }> = {
  A: { bg: '#15803d', text: '#ffffff' },
  B: { bg: '#0369a1', text: '#ffffff' },
  C: { bg: '#b45309', text: '#ffffff' },
  D: { bg: '#c2410c', text: '#ffffff' },
  F: { bg: '#b91c1c', text: '#ffffff' },
};

function formatScoreDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function renderViolationCard(
  v: DiffViolation,
  type: 'new' | 'fixed' | 'persistent',
): string {
  const sev = SEVERITY_COLORS[v.severity];
  const borderLeftColor =
    type === 'new' ? '#dc2626' : type === 'fixed' ? '#16a34a' : '#94a3b8';

  const parts: string[] = [
    `<article class="violation-card" style="border-left-color: ${borderLeftColor};">`,
    `  <div class="violation-header">`,
    `    <span class="severity-badge" style="background:${sev.bg}; color:${sev.text}; border: 1px solid ${sev.border};">`,
    `      ${escapeHtml(v.severity.toUpperCase())}`,
    `    </span>`,
    `    <h3 class="violation-title">${escapeHtml(v.ruleId)}</h3>`,
    `  </div>`,
    `  <p class="violation-desc">${escapeHtml(v.description)}</p>`,
  ];

  if (v.failureSummary) {
    parts.push(
      `  <div class="failure-summary"><strong>Issue:</strong> ${escapeHtml(v.failureSummary)}</div>`,
    );
  }

  if (v.pageUrl) {
    parts.push(
      `  <div class="page-url"><strong>Page:</strong> <code>${escapeHtml(v.pageUrl)}</code></div>`,
    );
  }

  if (v.target.length > 0) {
    parts.push(
      `  <div class="target-selector"><strong>Target:</strong> <code>${escapeHtml(v.target.join(' '))}</code></div>`,
    );
  }

  if (v.html) {
    parts.push(
      `  <pre class="code-snippet"><code>${escapeHtml(v.html)}</code></pre>`,
    );
  }

  if (v.helpUrl) {
    parts.push(
      `  <div class="remediation-link"><a href="${escapeAttribute(v.helpUrl)}" target="_blank" rel="noopener noreferrer">Remediation Guide</a></div>`,
    );
  }

  parts.push(`</article>`);
  return parts.join('\n');
}

export function renderDiffHtmlReport(
  diff: ReportDiff,
  options?: DiffHtmlReportOptions,
): string {
  if (
    typeof diff !== 'object' ||
    diff === null ||
    !('status' in diff) ||
    !('counts' in diff) ||
    !('newViolations' in diff)
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'The provided diff object is not a valid ReportDiff.',
    );
  }

  const title = options?.title ?? 'A11yFix Accessibility Regression Diff';
  const statusCfg = STATUS_CONFIG[diff.status];

  const baselineScore =
    diff.kind === 'single' ? diff.baselineScore : diff.baselineSiteScore;
  const currentScore =
    diff.kind === 'single' ? diff.currentScore : diff.currentSiteScore;
  const baselineGrade = diff.baselineGrade;
  const currentGrade = diff.currentGrade;
  const baseGradeCfg = GRADE_COLORS[baselineGrade];
  const curGradeCfg = GRADE_COLORS[currentGrade];

  const deltaColor =
    diff.scoreDelta > 0
      ? '#15803d'
      : diff.scoreDelta < 0
        ? '#b91c1c'
        : '#475569';

  const newSection =
    diff.newViolations.length > 0
      ? `
      <section aria-labelledby="new-heading" class="diff-section">
        <h2 id="new-heading" class="section-title text-red">
          New Violations / Regressions (${diff.newViolations.length})
        </h2>
        <div class="violations-list">
          ${diff.newViolations.map((v) => renderViolationCard(v, 'new')).join('\n')}
        </div>
      </section>`
      : `
      <section aria-labelledby="new-heading" class="diff-section">
        <h2 id="new-heading" class="section-title text-green">✔ No Regressions Detected</h2>
        <p class="clean-msg">No new accessibility violations were introduced in this audit.</p>
      </section>`;

  const fixedSection =
    diff.fixedViolations.length > 0
      ? `
      <section aria-labelledby="fixed-heading" class="diff-section">
        <h2 id="fixed-heading" class="section-title text-green">
          Resolved Violations (${diff.fixedViolations.length})
        </h2>
        <div class="violations-list">
          ${diff.fixedViolations.map((v) => renderViolationCard(v, 'fixed')).join('\n')}
        </div>
      </section>`
      : '';

  const persistentSection =
    diff.persistentViolations.length > 0
      ? `
      <section aria-labelledby="persistent-heading" class="diff-section">
        <details>
          <summary id="persistent-heading" class="summary-toggle">
            <strong>Persistent Violations (${diff.persistentViolations.length})</strong> — click to inspect
          </summary>
          <div class="violations-list">
            ${diff.persistentViolations.map((v) => renderViolationCard(v, 'persistent')).join('\n')}
          </div>
        </details>
      </section>`
      : '';

  const multiPageSection =
    diff.kind === 'multi-page' && diff.pages.length > 0
      ? `
      <section aria-labelledby="pages-heading" class="diff-section">
        <h2 id="pages-heading" class="section-title">Per-Page Breakdown (${diff.pages.length} pages)</h2>
        <div class="table-wrap">
          <table class="pages-table">
            <thead>
              <tr>
                <th>Page URL</th>
                <th>Status</th>
                <th>Baseline</th>
                <th>Current</th>
                <th>Delta</th>
                <th>New</th>
                <th>Fixed</th>
              </tr>
            </thead>
            <tbody>
              ${diff.pages
                .map(
                  (p) => `
                <tr>
                  <td><code>${escapeHtml(p.url)}</code></td>
                  <td><span class="status-pill status-${p.status.toLowerCase()}">${escapeHtml(p.status)}</span></td>
                  <td>${p.baselineScore !== null ? p.baselineScore : '—'}</td>
                  <td>${p.currentScore !== null ? p.currentScore : '—'}</td>
                  <td style="color:${(p.scoreDelta ?? 0) > 0 ? '#15803d' : (p.scoreDelta ?? 0) < 0 ? '#b91c1c' : 'inherit'}; font-weight: bold;">
                    ${p.scoreDelta !== null ? formatScoreDelta(p.scoreDelta) : '—'}
                  </td>
                  <td style="color:#b91c1c; font-weight:bold;">${p.newCount}</td>
                  <td style="color:#15803d; font-weight:bold;">${p.fixedCount}</td>
                </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #ffffff;
      --card-bg: #f8fafc;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --code-bg: #f1f5f9;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #090d16;
        --card-bg: #111827;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --border: #1e293b;
        --code-bg: #1e293b;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      margin: 0;
      padding: 2rem;
    }
    .container { max-width: 960px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .brand { font-size: 1.5rem; font-weight: 700; }
    .brand span { color: #0284c7; }
    .status-badge { display: inline-block; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700; font-size: 0.875rem; text-transform: uppercase; }
    .score-banner { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; text-align: center; }
    .score-box h3 { margin: 0 0 0.5rem 0; font-size: 0.875rem; color: var(--text-muted); text-transform: uppercase; }
    .score-num { font-size: 2.25rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .grade-badge { font-size: 1rem; padding: 0.2rem 0.6rem; border-radius: 6px; }
    .delta-box { font-size: 1.75rem; font-weight: 900; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .metric-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; text-align: center; }
    .metric-val { font-size: 2rem; font-weight: 800; }
    .metric-label { font-size: 0.875rem; color: var(--text-muted); margin-top: 0.25rem; }
    .diff-section { margin-bottom: 2.5rem; }
    .section-title { font-size: 1.25rem; margin-bottom: 1rem; }
    .text-red { color: #dc2626; }
    .text-green { color: #16a34a; }
    .clean-msg { color: var(--text-muted); font-style: italic; }
    .violations-list { display: flex; flex-direction: column; gap: 1rem; }
    .violation-card { background: var(--card-bg); border: 1px solid var(--border); border-left-width: 6px; border-radius: 8px; padding: 1.25rem; }
    .violation-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
    .severity-badge { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; }
    .violation-title { margin: 0; font-size: 1.1rem; }
    .violation-desc { margin: 0 0 0.5rem 0; color: var(--text-muted); }
    .failure-summary { font-size: 0.9rem; margin-bottom: 0.5rem; }
    .target-selector { font-size: 0.875rem; margin-bottom: 0.5rem; }
    .page-url { font-size: 0.875rem; margin-bottom: 0.5rem; }
    .code-snippet { background: var(--code-bg); padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .remediation-link a { color: #0284c7; text-decoration: none; font-size: 0.875rem; }
    .remediation-link a:hover { text-decoration: underline; }
    .summary-toggle { font-size: 1rem; cursor: pointer; padding: 0.75rem 0; }
    .table-wrap { overflow-x: auto; }
    .pages-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; text-align: left; }
    .pages-table th, .pages-table td { padding: 0.75rem; border-bottom: 1px solid var(--border); }
    .pages-table th { color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; }
    .status-pill { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
    .status-regressed { background: #fee2e2; color: #991b1b; }
    .status-improved { background: #dcfce7; color: #166534; }
    .status-unchanged { background: #f1f5f9; color: #334155; }
    .status-new_page { background: #e0f2fe; color: #0369a1; }
    .status-removed_page { background: #f3e8ff; color: #6b21a8; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">A11y<span>Fix</span> Regression Report</div>
      <span class="status-badge" style="background:${statusCfg.bg}; color:${statusCfg.text};">
        ${escapeHtml(statusCfg.label)}
      </span>
    </header>

    <div class="score-banner">
      <div class="score-box">
        <h3>Baseline Score</h3>
        <div class="score-num">
          ${baselineScore}/100
          <span class="grade-badge" style="background:${baseGradeCfg.bg}; color:${baseGradeCfg.text};">${baselineGrade}</span>
        </div>
      </div>
      <div class="delta-box" style="color:${deltaColor};">
        ${formatScoreDelta(diff.scoreDelta)}
      </div>
      <div class="score-box">
        <h3>Current Score</h3>
        <div class="score-num">
          ${currentScore}/100
          <span class="grade-badge" style="background:${curGradeCfg.bg}; color:${curGradeCfg.text};">${currentGrade}</span>
        </div>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-val text-red">${diff.counts.newCount}</div>
        <div class="metric-label">New Regressions</div>
      </div>
      <div class="metric-card">
        <div class="metric-val text-green">${diff.counts.fixedCount}</div>
        <div class="metric-label">Fixed Violations</div>
      </div>
      <div class="metric-card">
        <div class="metric-val" style="color:var(--text-muted);">${diff.counts.persistentCount}</div>
        <div class="metric-label">Persistent Violations</div>
      </div>
    </div>

    ${newSection}
    ${fixedSection}
    ${persistentSection}
    ${multiPageSection}
  </div>
</body>
</html>`;
}
