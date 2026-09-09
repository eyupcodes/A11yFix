/**
 * File export utilities for accessibility reports.
 *
 * Handles file-system output, format auto-detection, directory creation,
 * and predictable error wrapping.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname } from 'node:path';

import type { AccessibilityReport } from '@a11yfix/core';

import { ReporterError } from './errors.js';
import { renderHtmlReport } from './html.js';
import { renderJsonReport } from './json.js';
import type { ReportFormat, WriteReportOptions } from './types.js';

function resolveFormat(
  outputPath: string,
  explicitFormat?: ReportFormat,
): ReportFormat {
  if (explicitFormat) {
    if (explicitFormat !== 'json' && explicitFormat !== 'html') {
      throw new ReporterError(
        'UNSUPPORTED_FORMAT',
        `Unsupported report format: "${String(explicitFormat)}". Expected "json" or "html".`,
      );
    }
    return explicitFormat;
  }

  const ext = extname(outputPath).toLowerCase();
  if (ext === '.json') {
    return 'json';
  }
  if (ext === '.html' || ext === '.htm') {
    return 'html';
  }

  throw new ReporterError(
    'UNSUPPORTED_FORMAT',
    `Cannot infer report format from file extension "${ext}". Use .json or .html extension, or specify format explicitly.`,
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Writes an AccessibilityReport to disk in either JSON or HTML format.
 *
 * @param report The validated AccessibilityReport.
 * @param outputPath Target file path. Parent directories will be created if needed.
 * @param options Format and rendering options.
 * @throws {ReporterError} if validation fails, format is unsupported, or write fails.
 */
export async function writeReport(
  report: AccessibilityReport | import('@a11yfix/core').MultiPageReport,
  outputPath: string,
  options?: WriteReportOptions,
): Promise<void> {
  const format = resolveFormat(outputPath, options?.format);

  const jsonOptions =
    options?.pretty !== undefined ? { pretty: options.pretty } : undefined;
  const htmlOptions =
    options?.title !== undefined ? { title: options.title } : undefined;

  const isMultiPage =
    typeof report === 'object' &&
    report !== null &&
    'summary' in report &&
    'pages' in report &&
    'commonViolations' in report;

  const content = isMultiPage
    ? format === 'json'
      ? (await import('./multi-page-json.js')).renderMultiPageJsonReport(
          report,
          jsonOptions,
        )
      : (await import('./multi-page-html.js')).renderMultiPageHtmlReport(
          report,
          htmlOptions,
        )
    : format === 'json'
      ? renderJsonReport(report, jsonOptions)
      : renderHtmlReport(report, htmlOptions);

  try {
    const parentDir = dirname(outputPath);
    if (parentDir && parentDir !== '.') {
      await mkdir(parentDir, { recursive: true });
    }
    await writeFile(outputPath, content, 'utf8');
  } catch (err: unknown) {
    if (err instanceof ReporterError) {
      throw err;
    }
    throw new ReporterError(
      'FILE_WRITE_FAILED',
      `Failed to write report to "${outputPath}": ${getErrorMessage(err)}`,
      { cause: err },
    );
  }
}
