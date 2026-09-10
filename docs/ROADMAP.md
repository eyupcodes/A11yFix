# Roadmap

## M1 Foundation — complete

Establish the private TypeScript monorepo, strict build/test/lint infrastructure, workspace boundaries, CI, and project documentation.

## M2 Scanner — complete

Add Playwright browser automation and axe-core audit execution.

## M3 Core normalization/scoring — complete

Add normalized findings, WCAG mapping, severity classification, prioritization scoring, and remediation models.

## M4 Reporter — complete

Add JSON and HTML report generation and export behavior.

## M5 CLI — complete

Add developer-facing scan commands and report output workflows.

## M6 Tests — complete

Expand unit, integration, and end-to-end coverage across scanner, core, reporter, and CLI workflows.

## M7 GitHub polish / v0.1.0 — complete

Harden documentation, runnable examples, release readiness, and monorepo verification for the v0.1.0 release.

## M8 Web UI — complete

Deliver interactive web dashboard in `apps/web` with Vite + React 19 frontend and lightweight Node.js API server (`/api/scan`, `/api/export`, `/api/health`), WCAG 2.1 AA compliant design tokens, real-time filtering, DOM snippet viewer, and HTML/JSON report downloads.

## M9 Multi-page crawling — complete

Crawl entire websites from a seed URL with BFS queue execution, same-origin link discovery and cycle avoidance, cross-page aggregation (site score/grade, per-page breakdown, recurring site-wide violations), and multi-page JSON+HTML reporting. Ships `a11yfix crawl <url>` with live terminal progress and threshold gates, plus `POST /api/crawl` in `apps/web`.

## M10 CI/SARIF — complete

OASIS SARIF v2.1.0 report generation in `@a11yfix/reporter` for GitHub Code Scanning, GitLab Security, and Azure DevOps integration. Full rule descriptors with WCAG tags and severity mapping (`critical`/`serious` → `error`, `moderate` → `warning`, `minor` → `note`), element snippets, and CSS selector logical locations. Adds `--format sarif` to `a11yfix scan` and `a11yfix crawl` in `apps/cli`, `format: 'sarif'` in `apps/web` export API, and sample `.github/workflows/accessibility-scan.yml` CI workflow.

## Future

- M11 Regression tracking
- M12 AI-assisted remediation
