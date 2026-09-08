import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { type AccessibilityReport, analyzeAxeResults } from '@a11yfix/core';
import { writeReport } from '@a11yfix/reporter';
import { auditPage, scanPage, withChromiumPage } from '@a11yfix/scanner';
import { afterEach, describe, expect, it } from 'vitest';

import { formatTerminalSummary } from './formatters.js';

const TEST_OUT_DIR = join(process.cwd(), 'test-e2e-output');

const INACCESSIBLE_FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Inaccessible Fixture Page</title>
  </head>
  <body>
    <header>
      <h1>Web Accessibility Defect Showcase</h1>
    </header>
    <main>
      <section>
        <h2>Missing Alt Text</h2>
        <img id="logo-defect" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
      </section>
      <section>
        <h2>Unlabelled Action Button</h2>
        <button id="defect-btn" type="button"></button>
      </section>
      <section>
        <h2>Low Contrast Subtext</h2>
        <p id="contrast-defect" style="color: #d1d5db; background-color: #ffffff;">
          Nearly invisible text against white ground.
        </p>
      </section>
    </main>
  </body>
</html>`;

const ACCESSIBLE_FIXTURE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Accessible Compliant Showcase</title>
  </head>
  <body>
    <header role="banner">
      <nav aria-label="Main Navigation">
        <ul>
          <li><a href="#main-content">Skip to content</a></li>
        </ul>
      </nav>
    </header>
    <main id="main-content">
      <h1>Compliant Accessibility Page</h1>
      <section>
        <h2>Image with Accessible Alt</h2>
        <img id="logo-ok" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="A11yFix Compliance Logo">
      </section>
      <section>
        <h2>Accessible Action Button</h2>
        <button id="ok-btn" type="button">Perform Search</button>
      </section>
      <section>
        <h2>High Contrast Readable Text</h2>
        <p style="color: #0f172a; background-color: #ffffff;">
          Crisp high-contrast text conforming to WCAG 2.1 AA standards.
        </p>
      </section>
    </main>
  </body>
</html>`;

describe('End-to-End Monorepo Integration & Self-Audit', () => {
  afterEach(async () => {
    await rm(TEST_OUT_DIR, { recursive: true, force: true });
  });

  it('runs complete inaccessible page pipeline and verifies generated HTML report is 100% accessible', async () => {
    await withChromiumPage(async (page) => {
      await page.route('https://fixture.test/inaccessible', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: INACCESSIBLE_FIXTURE_HTML,
        });
      });

      // 1. Scanner: Audit real browser DOM using Playwright + axe-core
      const scanResult = await scanPage(
        page,
        'https://fixture.test/inaccessible',
        'https://fixture.test/inaccessible',
      );

      expect(scanResult.requestedUrl).toBe('https://fixture.test/inaccessible');
      expect(scanResult.title).toBe('Inaccessible Fixture Page');
      expect(scanResult.durationMs).toBeGreaterThan(0);

      // 2. Core: Normalization, WCAG mapping, severity assignment, and scoring
      const report = analyzeAxeResults(scanResult.axe, scanResult);

      expect(report.score).toBeLessThan(90);
      expect(report.grade).not.toBe('A');
      expect(report.findings.length).toBeGreaterThanOrEqual(2);

      const ruleIds = report.findings.map((f) => f.ruleId);
      expect(ruleIds).toContain('image-alt');
      expect(ruleIds).toContain('button-name');

      // 3. CLI Formatters: Formats human-readable terminal summary
      const summary = formatTerminalSummary(report, { threshold: 90 });
      expect(summary).toContain('A11yFix Accessibility Audit Report');
      expect(summary).toContain('image-alt');
      expect(summary).toContain('button-name');
      expect(summary).toContain('✖ FAIL:');

      // 4. Reporter: Export accessible HTML document to disk
      const reportPath = join(TEST_OUT_DIR, 'inaccessible-audit.html');
      await writeReport(report, reportPath);

      const generatedHtml = await readFile(reportPath, 'utf8');
      expect(generatedHtml).toContain('<!DOCTYPE html>');
      expect(generatedHtml).toContain('Inaccessible Fixture Page');
      expect(generatedHtml).toContain('image-alt');
      expect(generatedHtml).toContain('button-name');

      // 5. THE SELF-AUDIT:
      // Load A11yFix's own generated HTML report back into Chromium and audit it with axe-core.
      // Proves that A11yFix's generated reports are 100% WCAG compliant with 0 violations!
      await page.setContent(generatedHtml, {
        waitUntil: 'domcontentloaded',
      });
      const selfAuditAxe = await auditPage(page);

      expect(selfAuditAxe.violations).toEqual([]);
      expect(selfAuditAxe.violations).toHaveLength(0);
    });
  }, 90_000);

  it('runs complete accessible page pipeline to perfect score and valid JSON export', async () => {
    await withChromiumPage(async (page) => {
      await page.route('https://fixture.test/accessible', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: ACCESSIBLE_FIXTURE_HTML,
        });
      });

      // 1. Scanner: Audit compliant DOM
      const scanResult = await scanPage(
        page,
        'https://fixture.test/accessible',
        'https://fixture.test/accessible',
      );

      // 2. Core: Analyze clean axe run
      const report = analyzeAxeResults(scanResult.axe, scanResult);

      expect(report.score).toBe(100);
      expect(report.grade).toBe('A');
      expect(report.findings).toHaveLength(0);
      expect(report.breakdown.totalPenalty).toBe(0);

      // 3. CLI Formatters: PASS status
      const summary = formatTerminalSummary(report, { threshold: 90 });
      expect(summary).toContain('✔ PASS: Score 100 meets threshold 90');
      expect(summary).toContain('Score:       100/100 (Grade A)');
      expect(summary).toContain('No accessibility violations detected');

      // 4. Reporter: Export JSON
      const reportJsonPath = join(TEST_OUT_DIR, 'accessible-audit.json');
      await writeReport(report, reportJsonPath, { format: 'json' });

      const generatedJson = JSON.parse(
        await readFile(reportJsonPath, 'utf8'),
      ) as AccessibilityReport;
      expect(generatedJson.score).toBe(100);
      expect(generatedJson.grade).toBe('A');
      expect(generatedJson.findings).toEqual([]);
      expect(generatedJson.meta.title).toBe('Accessible Compliant Showcase');
    });
  }, 90_000);
});
