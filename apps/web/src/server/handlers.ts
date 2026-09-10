import {
  analyzeAxeResults,
  analyzeCrawlResults,
  diffReports,
  generateRemediationPatch,
  generateReportRemediationPlan,
  isCoreError,
} from '@a11yfix/core';
import {
  renderHtmlReport,
  renderJsonReport,
  renderMultiPageHtmlReport,
  renderMultiPageJsonReport,
  renderSarifReport,
  ReporterError,
} from '@a11yfix/reporter';
import { crawlSite, scanAccessibility, ScannerError } from '@a11yfix/scanner';

import type {
  ApiErrorResponse,
  CrawlApiRequest,
  DiffApiRequest,
  ExportApiRequest,
  HealthApiResponse,
  RemediateApiRequest,
  ScanApiRequest,
} from './types.js';

export function handleHealth(): {
  readonly status: number;
  readonly body: HealthApiResponse;
} {
  return {
    status: 200,
    body: {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleScan(
  payload: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('url' in payload) ||
    typeof (payload as ScanApiRequest).url !== 'string' ||
    !(payload as ScanApiRequest).url.trim()
  ) {
    const error: ApiErrorResponse = {
      error: 'Missing or invalid "url" field in scan request body.',
      code: 'INVALID_REQUEST',
    };
    return { status: 400, body: error };
  }

  const { url, timeout } = payload as ScanApiRequest;

  try {
    const scanOptions =
      timeout !== undefined ? { navigationTimeoutMs: timeout } : undefined;
    const scanResult = await scanAccessibility(url.trim(), scanOptions);
    const report = analyzeAxeResults(scanResult.axe, scanResult);
    return { status: 200, body: report };
  } catch (err: unknown) {
    if (err instanceof ScannerError) {
      const statusCode =
        err.code === 'INVALID_URL' ||
        err.code === 'UNSUPPORTED_PROTOCOL' ||
        err.code === 'PRIVATE_TARGET'
          ? 400
          : 502;

      const error: ApiErrorResponse = {
        error: err.message,
        code: err.code,
      };
      return { status: statusCode, body: error };
    }

    const message =
      err instanceof Error ? err.message : 'Unknown scanning failure.';
    const error: ApiErrorResponse = {
      error: message,
      code: 'INTERNAL_ERROR',
    };
    return { status: 500, body: error };
  }
}

export async function handleCrawl(
  payload: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('url' in payload) ||
    typeof (payload as CrawlApiRequest).url !== 'string' ||
    !(payload as CrawlApiRequest).url.trim()
  ) {
    const error: ApiErrorResponse = {
      error: 'Missing or invalid "url" field in crawl request body.',
      code: 'INVALID_REQUEST',
    };
    return { status: 400, body: error };
  }

  const { url, maxPages, maxDepth, timeout } = payload as CrawlApiRequest;

  if (
    maxPages !== undefined &&
    (typeof maxPages !== 'number' || Number.isNaN(maxPages) || maxPages < 1)
  ) {
    return {
      status: 400,
      body: {
        error: 'Invalid "maxPages": must be a positive number.',
        code: 'INVALID_REQUEST',
      } satisfies ApiErrorResponse,
    };
  }

  if (
    maxDepth !== undefined &&
    (typeof maxDepth !== 'number' || Number.isNaN(maxDepth) || maxDepth < 0)
  ) {
    return {
      status: 400,
      body: {
        error: 'Invalid "maxDepth": must be zero or positive.',
        code: 'INVALID_REQUEST',
      } satisfies ApiErrorResponse,
    };
  }

  if (
    timeout !== undefined &&
    (typeof timeout !== 'number' || Number.isNaN(timeout) || timeout <= 0)
  ) {
    return {
      status: 400,
      body: {
        error: 'Invalid "timeout": must be a positive number.',
        code: 'INVALID_REQUEST',
      } satisfies ApiErrorResponse,
    };
  }

  try {
    const crawlResult = await crawlSite(url.trim(), {
      ...(maxPages !== undefined ? { maxPages } : {}),
      ...(maxDepth !== undefined ? { maxDepth } : {}),
      ...(timeout !== undefined ? { navigationTimeoutMs: timeout } : {}),
    });

    const report = analyzeCrawlResults({
      seedUrl: crawlResult.seedUrl,
      pages: crawlResult.pages.map((p) => ({
        url: p.url,
        depth: p.depth,
        scanResult: p.scanResult,
        error: p.error,
      })),
      durationMs: crawlResult.durationMs,
      startedAt: crawlResult.startedAt,
    });

    return { status: 200, body: report };
  } catch (err: unknown) {
    if (err instanceof ScannerError) {
      const statusCode =
        err.code === 'INVALID_URL' ||
        err.code === 'UNSUPPORTED_PROTOCOL' ||
        err.code === 'PRIVATE_TARGET'
          ? 400
          : 502;
      return {
        status: statusCode,
        body: { error: err.message, code: err.code } satisfies ApiErrorResponse,
      };
    }

    const message =
      err instanceof Error ? err.message : 'Unknown crawl failure.';
    return {
      status: 500,
      body: {
        error: message,
        code: 'INTERNAL_ERROR',
      } satisfies ApiErrorResponse,
    };
  }
}

export function handleExport(payload: unknown): {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
} {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('report' in payload) ||
    !('format' in payload)
  ) {
    return {
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Missing "report" or "format" field in export request body.',
        code: 'INVALID_REQUEST',
      }),
    };
  }

  const { report, format } = payload as ExportApiRequest;

  if (format !== 'html' && format !== 'json' && format !== 'sarif') {
    return {
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: `Unsupported export format "${String(format)}". Must be "html", "json", or "sarif".`,
        code: 'UNSUPPORTED_FORMAT',
      }),
    };
  }

  try {
    if (format === 'sarif') {
      const sarif = renderSarifReport(report, { pretty: true });
      return {
        status: 200,
        contentType: 'application/sarif+json; charset=utf-8',
        body: sarif,
      };
    }

    const isMultiPage =
      typeof report === 'object' &&
      report !== null &&
      'summary' in report &&
      'pages' in report &&
      'commonViolations' in report;

    if (format === 'html') {
      const html = isMultiPage
        ? renderMultiPageHtmlReport(report)
        : renderHtmlReport(report);
      return {
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: html,
      };
    }

    const json = isMultiPage
      ? renderMultiPageJsonReport(report, { pretty: true })
      : renderJsonReport(report, { pretty: true });
    return {
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: json,
    };
  } catch (err: unknown) {
    if (err instanceof ReporterError) {
      return {
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: err.message,
          code: err.code,
        }),
      };
    }

    const message =
      err instanceof Error ? err.message : 'Report rendering failed.';
    return {
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: message,
        code: 'INTERNAL_ERROR',
      }),
    };
  }
}

export function handleDiff(payload: unknown): {
  readonly status: number;
  readonly body: unknown;
} {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('baseline' in payload) ||
    !('current' in payload)
  ) {
    const error: ApiErrorResponse = {
      error: 'Missing "baseline" or "current" field in diff request body.',
      code: 'INVALID_REQUEST',
    };
    return { status: 400, body: error };
  }

  const { baseline, current } = payload as DiffApiRequest;

  try {
    const diff = diffReports(baseline, current);
    return { status: 200, body: diff };
  } catch (err: unknown) {
    if (isCoreError(err)) {
      return {
        status: 400,
        body: { error: err.message, code: err.code } satisfies ApiErrorResponse,
      };
    }

    const message =
      err instanceof Error ? err.message : 'Unknown diff calculation failure.';
    return {
      status: 500,
      body: {
        error: message,
        code: 'INTERNAL_ERROR',
      } satisfies ApiErrorResponse,
    };
  }
}

export async function handleRemediate(
  payload: unknown,
): Promise<{ readonly status: number; readonly body: unknown }> {
  if (typeof payload !== 'object' || payload === null) {
    return {
      status: 400,
      body: {
        error: 'Invalid request body.',
        code: 'INVALID_REQUEST',
      } satisfies ApiErrorResponse,
    };
  }

  const req = payload as RemediateApiRequest;

  if (!req.finding && !req.report) {
    return {
      status: 400,
      body: {
        error:
          'Either "finding" or "report" must be provided in remediation request body.',
        code: 'INVALID_REQUEST',
      } satisfies ApiErrorResponse,
    };
  }

  const options = {
    framework: req.framework,
    provider: req.provider,
    apiKey: req.apiKey,
    endpoint: req.endpoint,
    model: req.model,
  };

  try {
    if (req.finding) {
      if (
        typeof req.finding !== 'object' ||
        req.finding === null ||
        typeof req.finding.ruleId !== 'string' ||
        !Array.isArray(req.finding.nodes)
      ) {
        return {
          status: 400,
          body: {
            error: 'Invalid "finding" object structure.',
            code: 'INVALID_REQUEST',
          } satisfies ApiErrorResponse,
        };
      }

      const patch = await generateRemediationPatch(
        req.finding,
        req.nodeIndex,
        options,
      );
      return { status: 200, body: patch };
    }

    if (
      typeof req.report !== 'object' ||
      req.report === null ||
      !Array.isArray(req.report.findings)
    ) {
      return {
        status: 400,
        body: {
          error: 'Invalid "report" object structure.',
          code: 'INVALID_REQUEST',
        } satisfies ApiErrorResponse,
      };
    }

    const plan = await generateReportRemediationPlan(req.report, options);
    return { status: 200, body: plan };
  } catch (err: unknown) {
    if (isCoreError(err)) {
      return {
        status: 400,
        body: { error: err.message, code: err.code } satisfies ApiErrorResponse,
      };
    }

    const message =
      err instanceof Error
        ? err.message
        : 'Unknown remediation generation failure.';
    return {
      status: 500,
      body: {
        error: message,
        code: 'INTERNAL_ERROR',
      } satisfies ApiErrorResponse,
    };
  }
}
