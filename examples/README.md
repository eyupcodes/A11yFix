# A11yFix Examples

This directory contains runnable examples and usage guides for both the CLI and programmatic TypeScript/Node.js APIs.

---

## 1. CLI Usage

The A11yFix CLI scans web pages, computes WCAG scores, displays terminal tables, and exports HTML or JSON reports.

### Basic Scan

Scan a public URL and render the terminal summary table:

```bash
pnpm --filter @a11yfix/cli scan https://example.com
```

Or when installed globally / linked:

```bash
a11yfix scan https://example.com
```

### Export HTML Report

Generate a standalone, accessible, zero-dependency HTML report:

```bash
a11yfix scan https://example.com --output report.html --format html
```

### Export JSON Report

Export structured JSON report for automation or CI logging:

```bash
a11yfix scan https://example.com --output report.json --format json
```

### CI Quality Gate (Threshold)

Fail CI builds with exit code 1 if the accessibility score drops below 85:

```bash
a11yfix scan https://example.com --threshold 85
```

### Stdout JSON (Piping to `jq`)

Output raw JSON to stdout for piping and scripting:

```bash
a11yfix scan https://example.com --json --quiet | jq '.score, .grade'
```

---

## 2. Programmatic Usage (TypeScript / Node.js)

You can consume `@a11yfix/scanner`, `@a11yfix/core`, and `@a11yfix/reporter` as modular packages in your own applications or custom CI pipelines.

### Running the Example Script

A complete runnable example is available at `examples/programmatic-scan.ts`. Run it with `tsx`:

```bash
pnpm tsx examples/programmatic-scan.ts https://example.com
```

### Code Example

```typescript
import { analyzeAxeResults } from '@a11yfix/core';
import {
  renderHtmlReport,
  renderJsonReport,
  writeReport,
} from '@a11yfix/reporter';
import { scanAccessibility } from '@a11yfix/scanner';

async function auditSite(url: string) {
  // 1. Audit page with headless Chromium & axe-core
  const scanResult = await scanAccessibility(url, {
    navigationTimeoutMs: 30_000,
  });

  // 2. Normalize findings, map WCAG criteria, calculate score (0-100) and grade (A-F)
  const report = analyzeAxeResults(scanResult.axe, scanResult);

  console.log(`Score: ${report.score}/100 (${report.grade})`);
  console.log(`Violations found: ${report.findings.length}`);

  // 3. Export HTML and JSON reports
  await writeReport(report, 'audit-report.html', { format: 'html' });
  await writeReport(report, 'audit-report.json', { format: 'json' });

  // Or get raw strings in-memory:
  const htmlString = renderHtmlReport(report);
  const jsonString = renderJsonReport(report);

  return report;
}

auditSite('https://example.com');
```

---

## 3. Package Responsibilities

| Package             | Role                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `@a11yfix/scanner`  | Launches Playwright Chromium, injects axe-core, collects page metadata.                                     |
| `@a11yfix/core`     | Normalizes axe-core output, maps WCAG 2.1/2.2 criteria, computes weighted 0-100 score and A-F letter grade. |
| `@a11yfix/reporter` | Renders fully accessible HTML reports (WCAG AA compliant) and structured JSON artifacts.                    |
| `@a11yfix/cli`      | Developer CLI tool (`a11yfix scan`) with terminal tables, spinners, and threshold exit gates.               |
