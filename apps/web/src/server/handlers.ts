import { analyzeAxeResults } from '@a11yfix/core';
import {
  renderHtmlReport,
  renderJsonReport,
  ReporterError,
} from '@a11yfix/reporter';
import { scanAccessibility, ScannerError } from '@a11yfix/scanner';

import type {
  ApiErrorResponse,
  ExportApiRequest,
  HealthApiResponse,
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

  if (format !== 'html' && format !== 'json') {
    return {
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: `Unsupported export format "${String(format)}". Must be "html" or "json".`,
        code: 'UNSUPPORTED_FORMAT',
      }),
    };
  }

  try {
    if (format === 'html') {
      const html = renderHtmlReport(report);
      return {
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: html,
      };
    }

    const json = renderJsonReport(report, { pretty: true });
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
