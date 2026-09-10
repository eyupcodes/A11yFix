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

# Regression tracking against baseline report
a11yfix scan https://example.com --baseline baseline-report.json

# Strict zero-regression CI gate (fails with exit code 1 if new violations appear)
a11yfix scan https://example.com --baseline baseline-report.json --fail-on-regression
a11yfix crawl https://example.com --baseline site-baseline.json --fail-on-regression

# Output raw JSON to stdout for piping
a11yfix scan https://example.com --json

# Quiet mode (suppress terminal summary)
a11yfix scan https://example.com --quiet --output report.html

# Generate framework-aware code remediation suggestions (HTML, React, Vue, Svelte)
a11yfix remediate https://example.com --framework react
a11yfix remediate report.json --framework html --diff
a11yfix remediate report.json --output remediation-guide.html --format html
a11yfix remediate report.json --provider openai --api-key $OPENAI_API_KEY
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

v0.1.0 — Ready. Milestones M1 through M12 complete.

The repository contains the monorepo foundation, the low-level scanning engine, the core analysis layer, the report generation layer, the developer-facing CLI, the interactive web dashboard, runnable examples, and comprehensive test suites:

- `@a11yfix/scanner` validates target URLs, drives headless Chromium through Playwright, injects axe-core, crawls full websites via BFS, and produces raw scan results.
- `@a11yfix/core` normalizes findings, maps WCAG criteria, classifies severity, aggregates multi-page crawl results, calculates multiset baseline regression diffs with element-level fingerprinting, scores reports through `analyzeAxeResults`, and generates framework-aware code patches and unified diffs via deterministic heuristics and pluggable LLM adapters (`generateRemediationPatch`, `generateReportRemediationPlan`).
- `@a11yfix/reporter` serializes JSON reports, renders standalone, responsive, accessible HTML reports, generates OASIS SARIF v2.1.0 reports for GitHub Code Scanning, renders accessible HTML/JSON diff comparison reports, and produces standalone HTML/JSON remediation guides through `renderRemediationHtmlReport` and `renderRemediationJsonReport`.
- `@a11yfix/cli` provides `a11yfix scan <url>`, `a11yfix crawl <url>`, and `a11yfix remediate <target>` commands with terminal formatters, threshold gates, baseline regression comparison (`-b, --baseline`), zero-regression CI enforcement (`--fail-on-regression`), framework targeting (`--framework`), unified diffs (`--diff`), and predictable exit codes (0, 1, 2).
- `@a11yfix/web` provides an interactive, accessible React dashboard and local Node.js API server for visual web scanning, real-time filtering, report downloads, diff calculations (`POST /api/diff`), and an interactive "Suggest Fix" remediation assistant (`POST /api/remediate`).
- Comprehensive test suites verify scanner edge cases and redirects, core scoring boundaries and schema resilience, reporter XSS security and rendering benchmarks, CLI Commander integration with real file export, web dashboard server and component rendering, and end-to-end monorepo pipeline integration with automated self-auditing of generated HTML reports (asserting 0 accessibility violations).
- Runnable programmatic examples and documentation live in `examples/`.

### Scanner security limitation

The local scanner performs obvious private/local target blocking, but full hosted-service SSRF defense will require DNS resolution and post-resolution validation later.

## Programmatic usage

```typescript
import {
  analyzeAxeResults,
  diffReports,
  generateReportRemediationPlan,
} from '@a11yfix/core';
import {
  renderDiffHtmlReport,
  renderHtmlReport,
  renderRemediationHtmlReport,
  writeReport,
} from '@a11yfix/reporter';
import { scanAccessibility } from '@a11yfix/scanner';

// Audit a URL
const scanResult = await scanAccessibility('https://example.com');
const report = analyzeAxeResults(scanResult.axe, scanResult);

console.log(`Score: ${report.score}/100 (${report.grade})`);
await writeReport(report, 'report.html', { format: 'html' });

// Track regressions against a baseline audit
const diff = diffReports(baselineReport, report);
console.log(`Status: ${diff.status} (Score delta: ${diff.scoreDelta})`);
console.log(`New violations (regressions): ${diff.newViolations.length}`);
const diffHtml = renderDiffHtmlReport(diff);

// Generate framework-aware code fixes and unified diffs
const remediationPlan = await generateReportRemediationPlan(report, {
  framework: 'react',
});
console.log(`Remediated: ${remediationPlan.remediatedCount} violations`);
const remediationHtml = renderRemediationHtmlReport(remediationPlan);
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
- Web UI
- Multi-page scanning
- SARIF & GitHub Actions integration
- Regression tracking & gating
- Framework-aware fixes & AI-assisted remediation (M12)

### Later

- Scheduled & continuous monitoring (M13)

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
