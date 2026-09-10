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
# Scan a single URL and display terminal summary
a11yfix scan https://example.com

# Crawl an entire site from a seed URL
a11yfix crawl https://example.com --max-pages 20 --max-depth 2
a11yfix crawl https://example.com --output site-report.html --format html
a11yfix crawl https://example.com --threshold 80  # exit 1 if site score < 80

# Export report to HTML, JSON, or SARIF
a11yfix scan https://example.com --output report.html
a11yfix scan https://example.com --output report.json --format json
a11yfix scan https://example.com --output results.sarif --format sarif
a11yfix crawl https://example.com --output site.sarif --format sarif

# CI threshold gate (fails with exit code 1 if score < 80)
a11yfix scan https://example.com --threshold 80

# Output raw JSON to stdout for piping
a11yfix scan https://example.com --json

# Quiet mode (suppress terminal summary)
a11yfix scan https://example.com --quiet --output report.html
```

## Web dashboard (M8)

A11yFix includes an interactive developer web UI:

```sh
# Start Vite development server with API proxy
pnpm --filter @a11yfix/web dev

# Build and start production web app and local API server
pnpm --filter @a11yfix/web build
pnpm --filter @a11yfix/web start
```

Open `http://localhost:5173` (dev) or `http://localhost:3001` (prod) to run audits, filter findings, inspect DOM elements, and export reports directly in the browser.

## Status

v0.1.0 — Ready. Milestones M1 through M10 complete.

The repository contains the monorepo foundation, the low-level scanning engine, the core analysis layer, the report generation layer, the developer-facing CLI, the interactive web dashboard, runnable examples, and comprehensive test suites:

- `@a11yfix/scanner` validates target URLs, drives headless Chromium through Playwright, injects axe-core, crawls full websites via BFS, and produces raw scan results.
- `@a11yfix/core` normalizes findings, maps WCAG criteria, classifies severity, aggregates multi-page crawl results, and scores reports through `analyzeAxeResults`.
- `@a11yfix/reporter` serializes JSON reports, renders standalone, responsive, accessible HTML reports, generates OASIS SARIF v2.1.0 reports for GitHub Code Scanning, and provides file export utilities through `renderJsonReport`, `renderHtmlReport`, `renderSarifReport`, and `writeReport`.
- `@a11yfix/cli` provides `a11yfix scan <url>` and `a11yfix crawl <url>` commands with formatters, threshold gates, export options (html, json, sarif), and predictable exit codes (0, 1, 2).
- `@a11yfix/web` provides an interactive, accessible React dashboard and local Node.js API server for visual web scanning, real-time filtering, and report downloads.
- Comprehensive test suites verify scanner edge cases and redirects, core scoring boundaries and schema resilience, reporter XSS security and rendering benchmarks, CLI Commander integration with real file export, web dashboard server and component rendering, and end-to-end monorepo pipeline integration with automated self-auditing of generated HTML reports (asserting 0 accessibility violations).
- Runnable programmatic examples and documentation live in `examples/`.

### Scanner security limitation

The local scanner performs obvious private/local target blocking, but full hosted-service SSRF defense will require DNS resolution and post-resolution validation later.

## Programmatic usage

```typescript
import { analyzeAxeResults } from '@a11yfix/core';
import { renderHtmlReport, writeReport } from '@a11yfix/reporter';
import { scanAccessibility } from '@a11yfix/scanner';

const scanResult = await scanAccessibility('https://example.com');
const report = analyzeAxeResults(scanResult.axe, scanResult);

console.log(`Score: ${report.score}/100 (${report.grade})`);
await writeReport(report, 'report.html', { format: 'html' });
```

See [examples/README.md](examples/README.md) for full programmatic and CLI examples.

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
