# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-17

### Added
- `@a11yfix/scanner`: Playwright and axe-core scanning engine.
- `@a11yfix/core`: finding normalisation, WCAG mapping and severity scoring.
- `@a11yfix/core`: regression tracking, diff reporting and CI gating.
- `@a11yfix/core`: heuristic remediation engine for high-frequency WCAG rules. It generates fixes for HTML, React JSX, Vue and Svelte as unified diffs. LLM providers (OpenAI, Anthropic, custom/Ollama) are optional, with a zero-network fallback.
- `@a11yfix/reporter`: JSON, HTML and OASIS SARIF v2.1.0 reports, plus JSON and HTML remediation reports.
- CLI: `a11yfix scan`, `a11yfix crawl` (multi-page crawling with aggregated reports) and `a11yfix remediate`, with terminal output and export to JSON, HTML or SARIF.
- `@a11yfix/web`: React dashboard and Node API (`/api/scan`, `/api/export`, `/api/remediate`, `/api/health`) with severity and text filters, light/dark themes and one-click export.
- A reusable `accessibility-scan.yml` GitHub Actions workflow.
- Runnable examples, plus architecture and roadmap docs.

### Fixed
- `lint` and `typecheck` build workspace dependencies first, so they pass on a clean checkout (#3).

### Changed
- GitHub Actions upgraded to the Node 24 majors (#1).
