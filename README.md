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

M3 — Core.

The repository contains the monorepo foundation, the low-level scanning engine, and the core analysis layer. `@a11yfix/scanner` validates a public URL, drives headless Chromium through Playwright, injects axe-core, and returns raw axe results plus scan metadata. `@a11yfix/core` turns those raw results into normalized findings with WCAG mapping, severity classification, remediation guidance, and a prioritization score through `analyzeAxeResults`.

Report generation and CLI scan behavior are not implemented yet.

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
