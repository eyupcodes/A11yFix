/**
 * Example: Programmatic accessibility scan using A11yFix monorepo packages.
 *
 * Runs a scan using `@a11yfix/scanner`, analyzes and scores findings with
 * `@a11yfix/core`, and generates HTML/JSON reports with `@a11yfix/reporter`.
 *
 * Run with:
 *   pnpm tsx examples/programmatic-scan.ts
 */

import { analyzeAxeResults } from '@a11yfix/core';
import {
  renderHtmlReport,
  renderJsonReport,
  writeReport,
} from '@a11yfix/reporter';
import { scanAccessibility } from '@a11yfix/scanner';

async function main(): Promise<void> {
  const targetUrl = process.argv[2] ?? 'https://example.com';
  console.log(`Starting accessibility scan for: ${targetUrl}\n`);

  // 1. Scanner: Launch headless Chromium, inject axe-core, audit DOM
  const scanResult = await scanAccessibility(targetUrl, {
    navigationTimeoutMs: 30_000,
  });

  console.log(`Audited: ${scanResult.title ?? targetUrl}`);
  console.log(`Duration: ${scanResult.durationMs}ms\n`);

  // 2. Core: Classify severity, map WCAG criteria, calculate score (0-100) and grade (A-F)
  const report = analyzeAxeResults(scanResult.axe, scanResult);

  console.log(`--- Audit Summary ---`);
  console.log(`Score: ${report.score}/100 (Grade ${report.grade})`);
  console.log(`Violations: ${report.findings.length}`);
  console.log(`Critical: ${report.breakdown.countsBySeverity.critical}`);
  console.log(`Serious:  ${report.breakdown.countsBySeverity.serious}`);
  console.log(`Moderate: ${report.breakdown.countsBySeverity.moderate}`);
  console.log(`Minor:    ${report.breakdown.countsBySeverity.minor}`);
  console.log(`Best Practice: ${report.breakdown.bestPracticeFindings}\n`);

  // 3. Reporter: Export HTML and JSON reports
  const htmlOut = 'example-report.html';
  const jsonOut = 'example-report.json';

  await writeReport(report, htmlOut, { format: 'html' });
  await writeReport(report, jsonOut, { format: 'json' });

  console.log(`Reports exported:`);
  console.log(`- HTML: ${htmlOut}`);
  console.log(`- JSON: ${jsonOut}`);

  // Optional: In-memory string rendering
  const _htmlString = renderHtmlReport(report);
  const _jsonString = renderJsonReport(report);
}

main().catch((error: unknown) => {
  console.error('Scan failed:', error);
  process.exit(1);
});
