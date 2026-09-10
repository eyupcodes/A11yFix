/**
 * Scan action execution pipeline for `@a11yfix/cli`.
 */

import { analyzeAxeResults } from '@a11yfix/core';
import { renderJsonReport, writeReport } from '@a11yfix/reporter';
import { scanAccessibility, ScannerError } from '@a11yfix/scanner';

import { formatError, formatTerminalSummary } from './formatters.js';
import {
  type CliIo,
  type ExitCode,
  EXIT_CODES,
  type ScanCommandOptions,
} from './types.js';

const DEFAULT_IO: CliIo = {
  stdout: (message: string) => {
    process.stdout.write(`${message}\n`);
  },
  stderr: (message: string) => {
    process.stderr.write(`${message}\n`);
  },
};

function validateOptions(
  options: ScanCommandOptions,
  io: CliIo,
): ExitCode | null {
  if (options.threshold !== undefined) {
    if (
      typeof options.threshold !== 'number' ||
      Number.isNaN(options.threshold) ||
      options.threshold < 0 ||
      options.threshold > 100
    ) {
      io.stderr(
        'Error [INVALID_THRESHOLD]: Threshold must be a number between 0 and 100.',
      );
      return EXIT_CODES.INVALID_ARGS;
    }
  }

  if (options.timeout !== undefined) {
    if (
      typeof options.timeout !== 'number' ||
      Number.isNaN(options.timeout) ||
      options.timeout <= 0
    ) {
      io.stderr(
        'Error [INVALID_TIMEOUT]: Timeout must be a positive number of milliseconds.',
      );
      return EXIT_CODES.INVALID_ARGS;
    }
  }

  if (options.format !== undefined) {
    if (
      options.format !== 'json' &&
      options.format !== 'html' &&
      options.format !== 'sarif'
    ) {
      io.stderr(
        `Error [INVALID_FORMAT]: Format must be "json", "html", or "sarif", received "${String(options.format)}".`,
      );
      return EXIT_CODES.INVALID_ARGS;
    }
  }

  return null;
}

/**
 * Executes a full accessibility scan pipeline against a target URL.
 *
 * @param url Target web page URL.
 * @param options CLI flags and configuration options.
 * @param io Standard I/O interfaces for output (defaults to process.stdout/stderr).
 * @returns Exit code representing the outcome of the scan command.
 */
export async function executeScan(
  url: string,
  options: ScanCommandOptions = {},
  io: CliIo = DEFAULT_IO,
): Promise<ExitCode> {
  const validationError = validateOptions(options, io);
  if (validationError !== null) {
    return validationError;
  }

  try {
    const scannerOptions =
      options.timeout !== undefined
        ? { navigationTimeoutMs: options.timeout }
        : undefined;
    const scanResult = await scanAccessibility(url, scannerOptions);

    const report = analyzeAxeResults(scanResult.axe, scanResult);

    if (options.output) {
      const writeOptions =
        options.format !== undefined ? { format: options.format } : undefined;
      await writeReport(report, options.output, writeOptions);
    }

    if (options.json) {
      io.stdout(renderJsonReport(report, { pretty: true }));
    } else if (!options.quiet) {
      const summaryOptions =
        options.threshold !== undefined
          ? { threshold: options.threshold }
          : undefined;
      io.stdout(formatTerminalSummary(report, summaryOptions));
    }

    if (options.threshold !== undefined && report.score < options.threshold) {
      return EXIT_CODES.FAILURE;
    }

    return EXIT_CODES.SUCCESS;
  } catch (err: unknown) {
    io.stderr(formatError(err));

    if (err instanceof ScannerError && err.code === 'INVALID_URL') {
      return EXIT_CODES.INVALID_ARGS;
    }

    return EXIT_CODES.FAILURE;
  }
}
