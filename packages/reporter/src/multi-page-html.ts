/**
 * Accessible HTML report renderer for multi-page website crawl audits.
 */

import type { Grade, MultiPageReport } from '@a11yfix/core';

import { escapeAttribute, escapeHtml } from './escape.js';
import type { HtmlReportOptions } from './types.js';
import { validateMultiPageReport } from './validate.js';

const GRADE_COLORS: Record<Grade, { bg: string; text: string }> = {
  A: { bg: '#15803d', text: '#ffffff' },
  B: { bg: '#0369a1', text: '#ffffff' },
  C: { bg: '#b45309', text: '#ffffff' },
  D: { bg: '#c2410c', text: '#ffffff' },
  F: { bg: '#b91c1c', text: '#ffffff' },
};

function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}

function getPageGrade(report: { score: number; grade: string }): {
  bg: string;
  text: string;
} {
  return GRADE_COLORS[report.grade as Grade] ?? GRADE_COLORS.F;
}

function getStyles(): string {
  return `
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
    .site-score-card { background: var(--surface); border: 3px solid; border-radius: 12px; padding: 1rem 1.5rem; text-align: center; min-width: 140px; }
    .site-score-number { font-size: 2.5rem; font-weight: 800; }
    .site-grade-badge { font-size: 0.85rem; font-weight: 700; border-radius: 999px; padding: 0.2rem 0.6rem; display: inline-block; }
    .pages-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .pages-table th, .pages-table td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    .pages-table th { background: var(--code-bg); font-weight: 600; }
    .severity-stats { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .severity-pill { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 700; }
  `;
}

export function renderMultiPageHtmlReport(
  report: MultiPageReport,
  options?: HtmlReportOptions,
): string {
  validateMultiPageReport(report);

  const siteColor = GRADE_COLORS[report.summary.siteGrade];
  const siteTitle =
    options?.title ?? `Site Accessibility Audit — ${report.summary.seedUrl}`;

  const pagesRows = report.pages
    .map((page) => {
      const pageReport = page.report;
      const badge = pageReport
        ? `<span style="background:${getPageGrade(pageReport).bg}; color:${getPageGrade(pageReport).text}; padding:0.2rem 0.5rem; border-radius:4px;">${pageReport.score} ${pageReport.grade}</span>`
        : `<span style="color:#b91c1c;">Failed</span>`;

      const urlCell = isSafeUrl(page.url)
        ? `<a href="${escapeAttribute(page.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(page.url)}</a>`
        : escapeHtml(page.url);

      const errorCell = page.error
        ? `<br><span style="color:#b91c1c; font-size:0.8rem;">${escapeHtml(page.error)}</span>`
        : '';

      return `<tr><td>${urlCell}${errorCell}</td><td>${page.depth}</td><td>${badge}</td><td>${pageReport?.findings.length ?? '—'}</td></tr>`;
    })
    .join('\n');

  const commonRows = report.commonViolations
    .map((v) => {
      const badge = v.isSiteWide
        ? '<span style="background:#fee2e2; color:#991b1b; padding:0.1rem 0.3rem; border-radius:3px; font-size:0.75rem;">Site-wide</span>'
        : `<span style="font-size:0.75rem;">${escapeHtml(v.severity)}</span>`;
      return `<tr>
        <td>${escapeHtml(v.ruleId)} ${badge}</td>
        <td>${escapeHtml(v.description)}</td>
        <td>${v.occurrenceCount} pages</td>
        <td>${v.totalNodes} nodes</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(siteTitle)}</title>
  <style>:root { --surface: #ffffff; --code-bg: #f1f5f9; --border: #e2e8f0; } @media (prefers-color-scheme: dark) { :root { --surface: #1e293b; --code-bg: #0f172a; --border: #334155; } } ${getStyles()}</style>
</head>
<body style="font-family: -apple-system, system-ui, sans-serif; background: #f8fafc; color: #0f172a; padding: 1rem; max-width: 1100px; margin: 0 auto;">
  <a href="#main-content" class="sr-only">Skip to main content</a>
  <header role="banner" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
    <h1>${escapeHtml(siteTitle)}</h1>
    <div class="site-score-card" style="border-color: ${siteColor.bg};">
      <div class="site-score-number">${report.summary.siteScore}</div>
      <span class="site-grade-badge" style="background: ${siteColor.bg}; color: ${siteColor.text};">Grade ${report.summary.siteGrade}</span>
      <div style="font-size:0.75rem; color:#475569;">Site Score</div>
    </div>
  </header>
  <main id="main-content" role="main">
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading">Site Summary</h2>
      <p><strong>Seed URL:</strong> ${escapeHtml(report.summary.seedUrl)}</p>
      <p><strong>Scanned:</strong> ${escapeHtml(report.summary.scannedAt)} &bull; Duration: ${report.summary.durationMs} ms</p>
      <p><strong>Pages:</strong> ${report.summary.totalPages} scanned, ${report.summary.successfulPages} successful, ${report.summary.failedPages} failed</p>
      <p><strong>Total violations:</strong> ${report.summary.totalViolations} &bull; Total passes: ${report.summary.totalPasses}</p>
      <div class="severity-stats">
        ${Object.entries(report.summary.countsBySeverity)
          .map(
            ([sev, c]) =>
              `<span class="severity-pill" style="background:#f1f5f9; border:1px solid #cbd5e1;">${escapeHtml(sev)}: ${c}</span>`,
          )
          .join('')}
      </div>
    </section>

    <section aria-labelledby="common-heading" style="margin-top: 2rem;">
      <h2 id="common-heading">Recurring Violations (${report.commonViolations.length})</h2>
      <table class="pages-table">
        <thead><tr><th>Rule</th><th>Description</th><th>Pages</th><th>Nodes</th></tr></thead>
        <tbody>${commonRows || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No recurring violations.</td></tr>'}</tbody>
      </table>
    </section>

    <section aria-labelledby="pages-heading" style="margin-top: 2rem;">
      <h2 id="pages-heading">Pages Scanned (${report.pages.length})</h2>
      <table class="pages-table" aria-label="Pages scanned">
        <thead><tr><th>URL</th><th>Depth</th><th>Score</th><th>Findings</th></tr></thead>
        <tbody>${pagesRows || '<tr><td colspan="4">No pages scanned.</td></tr>'}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}
