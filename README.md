# A11yFix

Find accessibility issues.
Understand why they matter.
Fix them before users find them.

A11yFix is an open-source, automated web accessibility scanner aimed at developers.

## Planned functionality

- Playwright browser automation
- axe-core scanning
- WCAG mapping
- Severity prioritization
- Developer-friendly remediation guidance
- JSON/HTML reporting
- CLI
- CI integration

## Planned CLI usage

```sh
a11yfix scan https://example.com
```

## Status

M4 — Reporter.

The repository contains the monorepo foundation, the low-level scanning engine, the core analysis layer, and the report generation layer:

- `@a11yfix/scanner` validates target URLs, drives headless Chromium through Playwright, injects axe-core, and produces raw scan results.
- `@a11yfix/core` normalizes findings, maps WCAG criteria, classifies severity, and scores reports through `analyzeAxeResults`.
- `@a11yfix/reporter` serializes JSON reports, renders standalone, responsive, accessible HTML reports, and provides file export utilities through `renderJsonReport`, `renderHtmlReport`, and `writeReport`.

CLI scan command workflows land in M5.

### Scanner security limitation

The local scanner performs obvious private/local target blocking, but full hosted-service SSRF defense will require DNS resolution and post-resolution validation later.

## Roadmap

### v0.1

- CLI scanner
- axe-core integration
- Normalized findings
- Scoring
- JSON report
- HTML report

### Later

- Web UI
- Multi-page scanning
- SARIF
- GitHub Actions integration
- Regression detection
- Framework-aware fixes
- Optional AI remediation assistance

## Development

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

See `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`.
