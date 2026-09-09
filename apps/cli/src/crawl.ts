/**
 * Crawl action execution: scan and audit an entire website by crawling from a seed URL.
 */

import { analyzeCrawlResults } from '@a11yfix/core';
import { writeReport } from '@a11yfix/reporter';
import { crawlSite, ScannerError } from '@a11yfix/scanner';

import { formatError, formatCrawlTerminalSummary } from './formatters.js';
import type { CliIo, ExitCode, CrawlCommandOptions } from './types.js';
import { EXIT_CODES } from './types.js';

const DEFAULT_IO: CliIo = {
  stdout: (message: string) => {
    process.stdout.write(`${message}\n`);
  },
  stderr: (message: string) => {
    process.stderr.write(`${message}\n`);
  },
};

function validateCrawlOptions(
  options: CrawlCommandOptions,
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

  if (options.maxPages !== undefined) {
    if (
      typeof options.maxPages !== 'number' ||
      Number.isNaN(options.maxPages) ||
      options.maxPages < 1
    ) {
      io.stderr(
        'Error [INVALID_MAX_PAGES]: Max pages must be a positive number.',
      );
      return EXIT_CODES.INVALID_ARGS;
    }
  }

  if (options.maxDepth !== undefined) {
    if (
      typeof options.maxDepth !== 'number' ||
      Number.isNaN(options.maxDepth) ||
      options.maxDepth < 0
    ) {
      io.stderr(
        'Error [INVALID_MAX_DEPTH]: Max depth must be zero or positive.',
      );
      return EXIT_CODES.INVALID_ARGS;
    }
  }

  if (options.format !== undefined) {
    if (options.format !== 'json' && options.format !== 'html') {
      io.stderr(
        `Error [INVALID_FORMAT]: Format must be "json" or "html", received "${String(options.format)}".`,
      );
      return EXIT_CODES.INVALID_ARGS;
    }
  }

  return null;
}

/**
 * Executes a multi-page website crawl and audits accessibility across crawled pages.
 */
export async function executeCrawl(
  url: string,
  options: CrawlCommandOptions = {},
  io: CliIo = DEFAULT_IO,
): Promise<ExitCode> {
  const validationError = validateCrawlOptions(options, io);
  if (validationError !== null) {
    return validationError;
  }

  try {
    let crawledPages = 0;

    const crawlResult = await crawlSite(url, {
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      navigationTimeoutMs: options.timeout,
      onPageScanned: (page) => {
        crawledPages += 1;
        if (!options.quiet) {
          io.stdout(
            `[${crawledPages}] ${page.scanResult ? 'Audited' : 'Skipped'} ${page.url}`,
          );
        }
      },
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

    if (options.output) {
      const writeOptions =
        options.format !== undefined ? { format: options.format } : undefined;
      // Reason: writeReport overload accepts MultiPageReport at runtime via duck-typing.
       
      await writeReport(report, options.output, writeOptions);
    }

    if (options.json) {
      const { renderMultiPageJsonReport } = await import('@a11yfix/reporter');
      io.stdout(renderMultiPageJsonReport(report, { pretty: true }));
    } else if (!options.quiet) {
      const summaryOptions =
        options.threshold !== undefined
          ? { threshold: options.threshold }
          : undefined;
      io.stdout(formatCrawlTerminalSummary(report, summaryOptions));
    }

    if (
      options.threshold !== undefined &&
      report.summary.siteScore < options.threshold
    ) {
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
