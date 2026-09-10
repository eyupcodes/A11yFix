/**
 * Accessible HTML remediation report renderer.
 *
 * Generates a standalone, responsive, accessible HTML5 remediation guide
 * from a validated `ReportRemediationPlan`. All untrusted values are strictly escaped.
 */

import type {
  RemediationConfidence,
  RemediationPatch,
  ReportRemediationPlan,
  RuleRemediationResult,
} from '@a11yfix/core';

import { escapeAttribute, escapeHtml, isSafeUrl } from './escape.js';
import { ReporterError } from './errors.js';
import type { RemediationHtmlReportOptions } from './types.js';

const CONFIDENCE_COLORS: Record<
  RemediationConfidence,
  { bg: string; text: string; border: string }
> = {
  high: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  medium: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  low: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
};

function renderPatchCard(patch: RemediationPatch, index: number): string {
  const conf = CONFIDENCE_COLORS[patch.confidence];
  const targetSelector = patch.target.join(' ') || 'unknown';

  const parts: string[] = [
    `<article class="patch-card">`,
    `  <div class="patch-header">`,
    `    <span class="patch-index">Node #${index + 1}</span>`,
    `    <code class="patch-target">${escapeHtml(targetSelector)}</code>`,
    `    <span class="confidence-badge" style="background:${conf.bg}; color:${conf.text}; border: 1px solid ${conf.border};">`,
    `      ${escapeHtml(patch.confidence.toUpperCase())} CONFIDENCE`,
    `    </span>`,
    `  </div>`,
    `  <p class="patch-explanation">${escapeHtml(patch.explanation)}</p>`,
  ];

  if (patch.changes.length > 0) {
    parts.push(
      `  <ul class="patch-changes">`,
      ...patch.changes.map((c) => `    <li>${escapeHtml(c)}</li>`),
      `  </ul>`,
    );
  }

  parts.push(
    `  <div class="code-comparison">`,
    `    <div class="code-box">`,
    `      <span class="code-label">Original HTML</span>`,
    `      <pre class="orig-code"><code>${escapeHtml(patch.originalHtml)}</code></pre>`,
    `    </div>`,
    `    <div class="code-box">`,
    `      <div class="code-header-bar">`,
    `        <span class="code-label">Fixed (${escapeHtml(patch.framework.toUpperCase())})</span>`,
    `        <button class="copy-btn" onclick="navigator.clipboard.writeText(this.getAttribute('data-code'))" data-code="${escapeAttribute(patch.fixedCode)}" aria-label="Copy fixed code">Copy</button>`,
    `      </div>`,
    `      <pre class="fixed-code"><code>${escapeHtml(patch.fixedCode)}</code></pre>`,
    `    </div>`,
    `  </div>`,
  );

  if (patch.diff) {
    parts.push(
      `  <details class="diff-details">`,
      `    <summary>View Unified Diff</summary>`,
      `    <pre class="diff-block"><code>${escapeHtml(patch.diff)}</code></pre>`,
      `  </details>`,
    );
  }

  parts.push(`</article>`);
  return parts.join('\n');
}

function renderRuleSection(rule: RuleRemediationResult): string {
  const safeHelpUrl = isSafeUrl(rule.helpUrl) ? rule.helpUrl : null;

  return [
    `<section class="rule-section" aria-labelledby="rule-${escapeAttribute(rule.ruleId)}">`,
    `  <div class="rule-header">`,
    `    <h2 id="rule-${escapeAttribute(rule.ruleId)}" class="rule-title">${escapeHtml(rule.ruleId)}</h2>`,
    safeHelpUrl
      ? `    <a href="${escapeAttribute(safeHelpUrl)}" class="rule-link" target="_blank" rel="noopener noreferrer">Documentation ↗</a>`
      : '',
    `  </div>`,
    `  <p class="rule-desc">${escapeHtml(rule.description)}</p>`,
    `  <div class="patches-list">`,
    ...rule.patches.map((patch, idx) => renderPatchCard(patch, idx)),
    `  </div>`,
    `</section>`,
  ].join('\n');
}

export function renderRemediationHtmlReport(
  plan: ReportRemediationPlan,
  options?: RemediationHtmlReportOptions,
): string {
  if (
    typeof plan !== 'object' ||
    plan === null ||
    !('results' in plan) ||
    !Array.isArray(plan.results)
  ) {
    throw new ReporterError(
      'INVALID_REPORT',
      'The provided plan object is not a valid ReportRemediationPlan.',
    );
  }

  const title =
    options?.title ??
    `A11yFix Accessibility Remediation Guide (${plan.framework.toUpperCase()})`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --code-bg: #f1f5f9;
      --diff-add: #dcfce7;
      --diff-add-text: #15803d;
      --diff-sub: #fee2e2;
      --diff-sub-text: #991b1b;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --surface: #1e293b;
        --border: #334155;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --primary: #3b82f6;
        --code-bg: #0b1329;
        --diff-add: #064e3b;
        --diff-add-text: #6ee7b7;
        --diff-sub: #7f1d1d;
        --diff-sub-text: #fca5a5;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    h1 { font-size: 1.75rem; margin-bottom: 0.75rem; }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .pill {
      background: var(--code-bg);
      border: 1px solid var(--border);
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-weight: 600;
    }
    .rule-section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .rule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .rule-title { font-size: 1.25rem; font-weight: 700; }
    .rule-link { color: var(--primary); font-size: 0.875rem; text-decoration: none; }
    .rule-link:hover { text-decoration: underline; }
    .rule-desc { color: var(--text-muted); margin-bottom: 1.25rem; font-size: 0.95rem; }
    .patches-list { display: flex; flex-direction: column; gap: 1.25rem; }
    .patch-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
    }
    .patch-header {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .patch-index { font-weight: 700; font-size: 0.875rem; color: var(--text-muted); }
    .patch-target {
      background: var(--code-bg);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: monospace;
    }
    .confidence-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
    }
    .patch-explanation { margin-bottom: 0.75rem; font-size: 0.95rem; }
    .patch-changes {
      list-style-position: inside;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .code-comparison {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }
    @media (min-width: 768px) {
      .code-comparison { grid-template-columns: 1fr 1fr; }
    }
    .code-box { display: flex; flex-direction: column; }
    .code-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }
    .code-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .copy-btn {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .copy-btn:hover { opacity: 0.9; }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      flex-grow: 1;
    }
    .fixed-code { border-color: var(--primary); }
    .diff-details { margin-top: 0.75rem; font-size: 0.875rem; }
    .diff-details summary { cursor: pointer; color: var(--primary); font-weight: 600; }
    .diff-block { margin-top: 0.5rem; white-space: pre; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>A11yFix Remediation Guide</h1>
      <div class="meta-bar">
        <span class="pill">Framework: ${escapeHtml(plan.framework.toUpperCase())}</span>
        <span class="pill">Provider: ${escapeHtml(plan.provider)}</span>
        <span class="pill">${escapeHtml(String(plan.remediatedCount))} / ${escapeHtml(String(plan.totalViolations))} Violations Fixed</span>
        <span>Generated: ${escapeHtml(plan.generatedAt)}</span>
      </div>
    </header>
    <main>
      ${plan.results.map((r: RuleRemediationResult) => renderRuleSection(r)).join('\n')}
    </main>
  </div>
</body>
</html>`;
}
