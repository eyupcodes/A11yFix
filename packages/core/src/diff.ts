/**
 * Core regression tracking and audit diff engine.
 *
 * Provides deterministic snapshot comparison between baseline and current
 * accessibility reports (both single-page and multi-page site crawls).
 * Tracks new violations (regressions), resolved violations (fixed),
 * persistent violations, score deltas, and regression status.
 */

import { CoreError } from './errors.js';
import { SEVERITY_ORDER } from './types.js';
import type {
  AccessibilityReport,
  DiffCounts,
  DiffStatus,
  DiffViolation,
  MultiPageReport,
  MultiPageReportDiff,
  PageDiffItem,
  ReportDiff,
  RuleDiffSummary,
  SingleReportDiff,
} from './types.js';

/**
 * Checks whether an unknown value conforms to the AccessibilityReport interface.
 */
export function isAccessibilityReport(
  value: unknown,
): value is AccessibilityReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'score' in value &&
    typeof (value as AccessibilityReport).score === 'number' &&
    'findings' in value &&
    Array.isArray((value as AccessibilityReport).findings) &&
    'grade' in value &&
    'breakdown' in value &&
    'ruleCounts' in value
  );
}

/**
 * Checks whether an unknown value conforms to the MultiPageReport interface.
 */
export function isMultiPageReport(value: unknown): value is MultiPageReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'summary' in value &&
    typeof (value as MultiPageReport).summary === 'object' &&
    (value as MultiPageReport).summary !== null &&
    'pages' in value &&
    Array.isArray((value as MultiPageReport).pages)
  );
}

interface NodeOccurrence {
  readonly fingerprint: string;
  readonly violation: DiffViolation;
}

function createNodeFingerprint(
  ruleId: string,
  target: readonly string[],
  html: string,
  pageUrl?: string,
): string {
  const prefix = pageUrl ? `${pageUrl}::` : '';
  const selector = target.join(' ').trim();
  const normalizedHtml = html.replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${prefix}${ruleId}::${selector}::${normalizedHtml}`;
}

function createRuleFingerprint(ruleId: string, pageUrl?: string): string {
  const prefix = pageUrl ? `${pageUrl}::` : '';
  return `${prefix}${ruleId}::<root>`;
}

function collectReportOccurrences(
  report: AccessibilityReport,
  pageUrl?: string,
): readonly NodeOccurrence[] {
  const occurrences: NodeOccurrence[] = [];
  for (const finding of report.findings ?? []) {
    if (finding.nodes.length === 0) {
      const fingerprint = createRuleFingerprint(finding.ruleId, pageUrl);
      const violation: DiffViolation = {
        ruleId: finding.ruleId,
        severity: finding.severity,
        help: finding.help,
        description: finding.description,
        target: [],
        html: '',
        failureSummary: null,
        ...(finding.remediation.helpUrl
          ? { helpUrl: finding.remediation.helpUrl }
          : {}),
        ...(pageUrl ? { pageUrl } : {}),
      };
      occurrences.push({ fingerprint, violation });
      continue;
    }

    for (const node of finding.nodes) {
      const fingerprint = createNodeFingerprint(
        finding.ruleId,
        node.target,
        node.html,
        pageUrl,
      );
      const violation: DiffViolation = {
        ruleId: finding.ruleId,
        severity: finding.severity,
        help: finding.help,
        description: finding.description,
        target: node.target,
        html: node.html,
        failureSummary: node.failureSummary,
        ...(finding.remediation.helpUrl
          ? { helpUrl: finding.remediation.helpUrl }
          : {}),
        ...(pageUrl ? { pageUrl } : {}),
      };
      occurrences.push({ fingerprint, violation });
    }
  }
  return occurrences;
}

function computeMultisetDiff(
  baselineOccurrences: readonly NodeOccurrence[],
  currentOccurrences: readonly NodeOccurrence[],
): {
  readonly newViolations: readonly DiffViolation[];
  readonly fixedViolations: readonly DiffViolation[];
  readonly persistentViolations: readonly DiffViolation[];
} {
  const baselineMap = new Map<
    string,
    { sample: DiffViolation; count: number }
  >();
  for (const { fingerprint, violation } of baselineOccurrences) {
    const entry = baselineMap.get(fingerprint);
    if (entry) {
      entry.count++;
    } else {
      baselineMap.set(fingerprint, { sample: violation, count: 1 });
    }
  }

  const currentMap = new Map<
    string,
    { sample: DiffViolation; count: number }
  >();
  for (const { fingerprint, violation } of currentOccurrences) {
    const entry = currentMap.get(fingerprint);
    if (entry) {
      entry.count++;
    } else {
      currentMap.set(fingerprint, { sample: violation, count: 1 });
    }
  }

  const allFingerprints = new Set<string>([
    ...baselineMap.keys(),
    ...currentMap.keys(),
  ]);

  const newViolations: DiffViolation[] = [];
  const fixedViolations: DiffViolation[] = [];
  const persistentViolations: DiffViolation[] = [];

  for (const fingerprint of allFingerprints) {
    const bEntry = baselineMap.get(fingerprint);
    const cEntry = currentMap.get(fingerprint);

    const bCount = bEntry ? bEntry.count : 0;
    const cCount = cEntry ? cEntry.count : 0;
    const sample = cEntry ? cEntry.sample : bEntry!.sample;

    const persistentCount = Math.min(bCount, cCount);
    for (let i = 0; i < persistentCount; i++) {
      persistentViolations.push(sample);
    }

    if (cCount > bCount) {
      const added = cCount - bCount;
      for (let i = 0; i < added; i++) {
        newViolations.push(sample);
      }
    } else if (bCount > cCount) {
      const removed = bCount - cCount;
      for (let i = 0; i < removed; i++) {
        fixedViolations.push(sample);
      }
    }
  }

  // Sort deterministically: severity first, then ruleId, then target
  const sortFn = (a: DiffViolation, b: DiffViolation): number => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const ruleDiff = a.ruleId.localeCompare(b.ruleId);
    if (ruleDiff !== 0) return ruleDiff;
    return a.target.join(' ').localeCompare(b.target.join(' '));
  };

  newViolations.sort(sortFn);
  fixedViolations.sort(sortFn);
  persistentViolations.sort(sortFn);

  return { newViolations, fixedViolations, persistentViolations };
}

function computeRulesSummary(
  baseline: AccessibilityReport,
  current: AccessibilityReport,
): readonly RuleDiffSummary[] {
  const ruleMeta = new Map<
    string,
    {
      severity: AccessibilityReport['findings'][number]['severity'];
      help: string;
      baselineCount: number;
      currentCount: number;
    }
  >();

  for (const f of baseline.findings) {
    const count = Math.max(f.nodes.length, 1);
    ruleMeta.set(f.ruleId, {
      severity: f.severity,
      help: f.help,
      baselineCount: count,
      currentCount: 0,
    });
  }

  for (const f of current.findings) {
    const count = Math.max(f.nodes.length, 1);
    const existing = ruleMeta.get(f.ruleId);
    if (existing) {
      existing.currentCount = count;
    } else {
      ruleMeta.set(f.ruleId, {
        severity: f.severity,
        help: f.help,
        baselineCount: 0,
        currentCount: count,
      });
    }
  }

  const summaries: RuleDiffSummary[] = [];
  for (const [ruleId, meta] of ruleMeta.entries()) {
    summaries.push({
      ruleId,
      severity: meta.severity,
      help: meta.help,
      baselineCount: meta.baselineCount,
      currentCount: meta.currentCount,
      delta: meta.currentCount - meta.baselineCount,
    });
  }

  // Sort: severity ascending (critical first), delta descending, ruleId ascending
  summaries.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const deltaDiff = Math.abs(b.delta) - Math.abs(a.delta);
    if (deltaDiff !== 0) return deltaDiff;
    return a.ruleId.localeCompare(b.ruleId);
  });

  return summaries;
}

function calculateDiffStatus(
  newCount: number,
  fixedCount: number,
  scoreDelta: number,
): DiffStatus {
  if (newCount > 0 && fixedCount > 0) {
    return 'MIXED';
  }
  if (newCount > 0) {
    return 'REGRESSED';
  }
  if (fixedCount > 0) {
    return 'IMPROVED';
  }
  if (scoreDelta < 0) {
    return 'REGRESSED';
  }
  if (scoreDelta > 0) {
    return 'IMPROVED';
  }
  return 'UNCHANGED';
}

/**
 * Compares two AccessibilityReport instances and produces a detailed SingleReportDiff.
 *
 * @param baseline Earlier audit report to compare against.
 * @param current Latest audit report.
 * @returns Structured single report diff.
 */
export function compareReports(
  baseline: AccessibilityReport,
  current: AccessibilityReport,
): SingleReportDiff {
  if (!isAccessibilityReport(baseline) || !isAccessibilityReport(current)) {
    throw new CoreError(
      'INVALID_REPORT',
      'Both arguments must be valid AccessibilityReport objects.',
    );
  }

  const baselineOccurrences = collectReportOccurrences(baseline);
  const currentOccurrences = collectReportOccurrences(current);

  const { newViolations, fixedViolations, persistentViolations } =
    computeMultisetDiff(baselineOccurrences, currentOccurrences);

  const scoreDelta = current.score - baseline.score;
  const status = calculateDiffStatus(
    newViolations.length,
    fixedViolations.length,
    scoreDelta,
  );

  const counts: DiffCounts = {
    baselineTotal: baselineOccurrences.length,
    currentTotal: currentOccurrences.length,
    newCount: newViolations.length,
    fixedCount: fixedViolations.length,
    persistentCount: persistentViolations.length,
  };

  const rulesSummary = computeRulesSummary(baseline, current);

  return {
    kind: 'single',
    baselineScore: baseline.score,
    currentScore: current.score,
    scoreDelta,
    baselineGrade: baseline.grade,
    currentGrade: current.grade,
    status,
    newViolations,
    fixedViolations,
    persistentViolations,
    rulesSummary,
    counts,
  };
}

/**
 * Compares two MultiPageReport crawl results and produces a MultiPageReportDiff.
 *
 * @param baseline Earlier multi-page crawl report.
 * @param current Latest multi-page crawl report.
 * @returns Structured multi-page crawl diff.
 */
export function compareMultiPageReports(
  baseline: MultiPageReport,
  current: MultiPageReport,
): MultiPageReportDiff {
  if (!isMultiPageReport(baseline) || !isMultiPageReport(current)) {
    throw new CoreError(
      'INVALID_REPORT',
      'Both arguments must be valid MultiPageReport objects.',
    );
  }

  // Collect occurrences across all successful pages
  const baselineOccurrences: NodeOccurrence[] = [];
  for (const page of baseline.pages) {
    if (page.report) {
      baselineOccurrences.push(
        ...collectReportOccurrences(page.report, page.url),
      );
    }
  }

  const currentOccurrences: NodeOccurrence[] = [];
  for (const page of current.pages) {
    if (page.report) {
      currentOccurrences.push(
        ...collectReportOccurrences(page.report, page.url),
      );
    }
  }

  const { newViolations, fixedViolations, persistentViolations } =
    computeMultisetDiff(baselineOccurrences, currentOccurrences);

  // Per-page mapping
  const baselinePageMap = new Map(baseline.pages.map((p) => [p.url, p]));
  const currentPageMap = new Map(current.pages.map((p) => [p.url, p]));

  const allUrls: string[] = [];
  for (const p of baseline.pages) {
    if (!allUrls.includes(p.url)) allUrls.push(p.url);
  }
  for (const p of current.pages) {
    if (!allUrls.includes(p.url)) allUrls.push(p.url);
  }

  const pageDiffs: PageDiffItem[] = [];

  for (const url of allUrls) {
    const basePage = baselinePageMap.get(url);
    const curPage = currentPageMap.get(url);

    if (!basePage && curPage) {
      const curOccurrences = curPage.report
        ? collectReportOccurrences(curPage.report, url)
        : [];
      pageDiffs.push({
        url,
        status: 'NEW_PAGE',
        baselineScore: null,
        currentScore: curPage.report?.score ?? null,
        scoreDelta: null,
        newCount: curOccurrences.length,
        fixedCount: 0,
        persistentCount: 0,
      });
      continue;
    }

    if (basePage && !curPage) {
      const baseOccurrences = basePage.report
        ? collectReportOccurrences(basePage.report, url)
        : [];
      pageDiffs.push({
        url,
        status: 'REMOVED_PAGE',
        baselineScore: basePage.report?.score ?? null,
        currentScore: null,
        scoreDelta: null,
        newCount: 0,
        fixedCount: baseOccurrences.length,
        persistentCount: 0,
      });
      continue;
    }

    if (basePage?.report && curPage?.report) {
      const singleDiff = compareReports(basePage.report, curPage.report);
      pageDiffs.push({
        url,
        status: singleDiff.status,
        baselineScore: basePage.report.score,
        currentScore: curPage.report.score,
        scoreDelta: singleDiff.scoreDelta,
        newCount: singleDiff.counts.newCount,
        fixedCount: singleDiff.counts.fixedCount,
        persistentCount: singleDiff.counts.persistentCount,
      });
    } else {
      pageDiffs.push({
        url,
        status: 'UNCHANGED',
        baselineScore: basePage?.report?.score ?? null,
        currentScore: curPage?.report?.score ?? null,
        scoreDelta: null,
        newCount: 0,
        fixedCount: 0,
        persistentCount: 0,
      });
    }
  }

  const scoreDelta = current.summary.siteScore - baseline.summary.siteScore;
  const status = calculateDiffStatus(
    newViolations.length,
    fixedViolations.length,
    scoreDelta,
  );

  const counts: DiffCounts = {
    baselineTotal: baselineOccurrences.length,
    currentTotal: currentOccurrences.length,
    newCount: newViolations.length,
    fixedCount: fixedViolations.length,
    persistentCount: persistentViolations.length,
  };

  return {
    kind: 'multi-page',
    baselineSiteScore: baseline.summary.siteScore,
    currentSiteScore: current.summary.siteScore,
    scoreDelta,
    baselineGrade: baseline.summary.siteGrade,
    currentGrade: current.summary.siteGrade,
    status,
    newViolations,
    fixedViolations,
    persistentViolations,
    pages: pageDiffs,
    counts,
  };
}

/**
 * Polymorphic diff comparison function accepting either single-page or multi-page reports.
 *
 * @param baseline Baseline report.
 * @param current Current report.
 * @returns SingleReportDiff or MultiPageReportDiff.
 */
export function diffReports(
  baseline: AccessibilityReport | MultiPageReport,
  current: AccessibilityReport | MultiPageReport,
): ReportDiff {
  if (isMultiPageReport(baseline) && isMultiPageReport(current)) {
    return compareMultiPageReports(baseline, current);
  }
  if (isAccessibilityReport(baseline) && isAccessibilityReport(current)) {
    return compareReports(baseline, current);
  }
  throw new CoreError(
    'INVALID_REPORT',
    'Both reports must be of the same type (both single-page or both multi-page).',
  );
}
