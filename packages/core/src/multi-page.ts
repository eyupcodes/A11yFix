/**
 * Multi-page audit aggregation, site-wide scoring, and recurring violation grouping.
 */

import { analyzeAxeResults } from './normalize.js';
import { gradeForScore } from './scoring.js';
import { SEVERITY_ORDER } from './types.js';
import type {
  AccessibilityReport,
  CommonViolation,
  CrawlInput,
  Finding,
  MultiPageItem,
  MultiPageReport,
  MultiPageSummary,
  Severity,
} from './types.js';

const EMPTY_SEVERITY_COUNTS: Record<Severity, number> = {
  critical: 0,
  serious: 0,
  moderate: 0,
  minor: 0,
};

/**
 * Aggregates individual page crawl scan results into a comprehensive site report.
 *
 * Computes mean site score, letter grade, counts, groups findings by ruleId across
 * pages, and identifies site-wide recurring violations.
 */
export function analyzeCrawlResults(crawl: CrawlInput): MultiPageReport {
  const pageItems: MultiPageItem[] = [];
  const successfulReports: Array<{ url: string; report: AccessibilityReport }> =
    [];

  for (const page of crawl.pages) {
    if (page.error !== undefined || !page.scanResult) {
      pageItems.push({
        url: page.url,
        depth: page.depth,
        report: null,
        error: page.error ?? 'Scan data unavailable',
      });
      continue;
    }

    try {
      const report = analyzeAxeResults(page.scanResult.axe, page.scanResult);
      pageItems.push({
        url: page.url,
        depth: page.depth,
        report,
        error: null,
      });
      successfulReports.push({ url: page.url, report });
    } catch (err) {
      pageItems.push({
        url: page.url,
        depth: page.depth,
        report: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successfulCount = successfulReports.length;
  const siteScore =
    successfulCount === 0
      ? 0
      : Math.round(
          successfulReports.reduce((sum, p) => sum + p.report.score, 0) /
            successfulCount,
        );

  const siteGrade = gradeForScore(siteScore);

  const countsBySeverity: Record<Severity, number> = {
    ...EMPTY_SEVERITY_COUNTS,
  };
  let totalViolations = 0;
  let totalPasses = 0;

  // Map ruleId to aggregated findings across pages
  const ruleMap = new Map<
    string,
    {
      sampleFinding: Finding;
      pages: Set<string>;
      totalNodes: number;
    }
  >();

  for (const { url, report } of successfulReports) {
    totalViolations += report.ruleCounts.violations;
    totalPasses += report.ruleCounts.passes;

    for (const [sev, count] of Object.entries(
      report.breakdown.countsBySeverity,
    )) {
      countsBySeverity[sev as Severity] += count;
    }

    for (const finding of report.findings) {
      const existing = ruleMap.get(finding.ruleId);
      if (!existing) {
        ruleMap.set(finding.ruleId, {
          sampleFinding: finding,
          pages: new Set([url]),
          totalNodes: finding.nodeCount,
        });
      } else {
        existing.pages.add(url);
        existing.totalNodes += finding.nodeCount;
      }
    }
  }

  const commonViolations: CommonViolation[] = Array.from(ruleMap.values()).map(
    ({ sampleFinding, pages, totalNodes }) => {
      const occurrenceCount = pages.size;
      const isSiteWide =
        occurrenceCount > 1 ||
        (successfulCount === 1 && occurrenceCount === 1) ||
        occurrenceCount >= Math.ceil(successfulCount / 2);

      return {
        ruleId: sampleFinding.ruleId,
        severity: sampleFinding.severity,
        description: sampleFinding.description,
        help: sampleFinding.help,
        wcag: sampleFinding.wcag,
        remediation: sampleFinding.remediation,
        occurrenceCount,
        pageUrls: Array.from(pages),
        totalNodes,
        isSiteWide,
      };
    },
  );

  // Deterministic order: isSiteWide first, then severity rank, then occurrenceCount desc, then ruleId asc
  commonViolations.sort((a, b) => {
    if (a.isSiteWide !== b.isSiteWide) {
      return a.isSiteWide ? -1 : 1;
    }
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;

    const occDiff = b.occurrenceCount - a.occurrenceCount;
    if (occDiff !== 0) return occDiff;

    return a.ruleId.localeCompare(b.ruleId);
  });

  const summary: MultiPageSummary = {
    seedUrl: crawl.seedUrl,
    totalPages: crawl.pages.length,
    successfulPages: successfulCount,
    failedPages: crawl.pages.length - successfulCount,
    siteScore,
    siteGrade,
    totalViolations,
    totalPasses,
    countsBySeverity,
    durationMs: crawl.durationMs ?? 0,
    scannedAt: crawl.startedAt ?? new Date().toISOString(),
  };

  return {
    summary,
    pages: pageItems,
    commonViolations,
  };
}
