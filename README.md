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

## CLI usage

```sh
# Scan a URL and display terminal summary
a11yfix scan https://example.com

# Export report to HTML or JSON
a11yfix scan https://example.com --output report.html
a11yfix scan https://example.com --output report.json --format json

# CI threshold gate (fails with exit code 1 if score < 80)
a11yfix scan https://example.com --threshold 80

# Output raw JSON to stdout for piping
a11yfix scan https://example.com --json

# Quiet mode (suppress terminal summary)
a11yfix scan https://example.com --quiet --output report.html
```

## Status

M6 — Tests.

The repository contains the monorepo foundation, the low-level scanning engine, the core analysis layer, the report generation layer, the developer-facing CLI, and comprehensive test suites:

- `@a11yfix/scanner` validates target URLs, drives headless Chromium through Playwright, injects axe-core, and produces raw scan results.
- `@a11yfix/core` normalizes findings, maps WCAG criteria, classifies severity, and scores reports through `analyzeAxeResults`.
- `@a11yfix/reporter` serializes JSON reports, renders standalone, responsive, accessible HTML reports, and provides file export utilities through `renderJsonReport`, `renderHtmlReport`, and `writeReport`.
- `@a11yfix/cli` provides the `a11yfix scan <url>` command with formatters, threshold gates, export options, and predictable exit codes (0, 1, 2).
- Comprehensive test suites verify scanner edge cases and redirects, core scoring boundaries and schema resilience, reporter XSS security and rendering benchmarks, CLI Commander integration with real file export, and end-to-end monorepo pipeline integration with automated self-auditing of generated HTML reports (asserting 0 accessibility violations).

Release preparation and GitHub polish lands in M7.

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
