/**
 * Commander CLI program setup and action wiring for `@a11yfix/cli`.
 */

import { Command, InvalidArgumentError } from 'commander';

import { executeCrawl } from './crawl.js';
import { executeScan } from './scan.js';
import {
  type CliIo,
  type CrawlCommandOptions,
  EXIT_CODES,
  type ScanCommandOptions,
} from './types.js';

export interface CreateProgramOptions {
  readonly io?: CliIo | undefined;
  readonly exitOverride?: boolean | undefined;
}

function parseThreshold(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new InvalidArgumentError(
      `Threshold must be a number between 0 and 100, received "${value}".`,
    );
  }
  return parsed;
}

function parseTimeout(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(
      `Timeout must be a positive number of milliseconds, received "${value}".`,
    );
  }
  return parsed;
}

function parseMaxPages(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new InvalidArgumentError(
      `Max pages must be a positive number, received "${value}".`,
    );
  }
  return parsed;
}

function parseMaxDepth(value: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new InvalidArgumentError(
      `Max depth must be zero or positive, received "${value}".`,
    );
  }
  return parsed;
}

/**
 * Creates and configures the `a11yfix` Commander program.
 *
 * @param config Optional test/execution overrides including standard I/O and exitOverride.
 * @returns Configured Command instance.
 */
export function createProgram(config: CreateProgramOptions = {}): Command {
  const program = new Command();

  program
    .name('a11yfix')
    .description('Automated web accessibility scanner for developers.')
    .version('0.1.0');

  if (config.exitOverride) {
    program.exitOverride();
  }

  program
    .command('scan <url>')
    .description('Scan a URL for accessibility violations.')
    .option(
      '-o, --output <path>',
      'file path to save report (json, html, or sarif)',
    )
    .option('-f, --format <format>', 'report format (json, html, or sarif)')
    .option(
      '-t, --threshold <score>',
      'fail with exit code 1 if score is below threshold (0-100)',
      parseThreshold,
    )
    .option(
      '--timeout <ms>',
      'navigation and scan timeout in milliseconds',
      parseTimeout,
    )
    .option('--json', 'output raw report as JSON to stdout')
    .option('-q, --quiet', 'suppress decorative terminal output')
    .action(
      async (
        url: string,
        cmdOptions: {
          output?: string;
          format?: string;
          threshold?: number;
          timeout?: number;
          json?: boolean;
          quiet?: boolean;
        },
      ) => {
        const scanOptions: ScanCommandOptions = {
          ...(cmdOptions.output !== undefined
            ? { output: cmdOptions.output }
            : {}),
          ...(cmdOptions.format !== undefined
            ? { format: cmdOptions.format as ScanCommandOptions['format'] }
            : {}),
          ...(cmdOptions.threshold !== undefined
            ? { threshold: cmdOptions.threshold }
            : {}),
          ...(cmdOptions.timeout !== undefined
            ? { timeout: cmdOptions.timeout }
            : {}),
          ...(cmdOptions.json !== undefined ? { json: cmdOptions.json } : {}),
          ...(cmdOptions.quiet !== undefined
            ? { quiet: cmdOptions.quiet }
            : {}),
        };

        const exitCode = await executeScan(url, scanOptions, config.io);
        if (exitCode !== EXIT_CODES.SUCCESS) {
          process.exitCode = exitCode;
        }
      },
    );

  program
    .command('crawl <url>')
    .description(
      'Crawl a website from a seed URL and audit accessibility across pages.',
    )
    .option(
      '-m, --max-pages <number>',
      'maximum pages to crawl (default: 10)',
      parseMaxPages,
    )
    .option(
      '-d, --max-depth <number>',
      'maximum crawl depth (default: 2)',
      parseMaxDepth,
    )
    .option(
      '-o, --output <path>',
      'file path to save report (json, html, or sarif)',
    )
    .option('-f, --format <format>', 'report format (json, html, or sarif)')
    .option(
      '-t, --threshold <score>',
      'fail with exit code 1 if site score is below threshold (0-100)',
      parseThreshold,
    )
    .option(
      '--timeout <ms>',
      'per-page navigation timeout in milliseconds',
      parseTimeout,
    )
    .option('--json', 'output raw report as JSON to stdout')
    .option('-q, --quiet', 'suppress live crawl progress')
    .action(
      async (
        url: string,
        cmdOptions: {
          maxPages?: number;
          maxDepth?: number;
          output?: string;
          format?: string;
          threshold?: number;
          timeout?: number;
          json?: boolean;
          quiet?: boolean;
        },
      ) => {
        const crawlOptions: CrawlCommandOptions = {
          ...(cmdOptions.maxPages !== undefined
            ? { maxPages: cmdOptions.maxPages }
            : {}),
          ...(cmdOptions.maxDepth !== undefined
            ? { maxDepth: cmdOptions.maxDepth }
            : {}),
          ...(cmdOptions.output !== undefined
            ? { output: cmdOptions.output }
            : {}),
          ...(cmdOptions.format !== undefined
            ? { format: cmdOptions.format as CrawlCommandOptions['format'] }
            : {}),
          ...(cmdOptions.threshold !== undefined
            ? { threshold: cmdOptions.threshold }
            : {}),
          ...(cmdOptions.timeout !== undefined
            ? { timeout: cmdOptions.timeout }
            : {}),
          ...(cmdOptions.json !== undefined ? { json: cmdOptions.json } : {}),
          ...(cmdOptions.quiet !== undefined
            ? { quiet: cmdOptions.quiet }
            : {}),
        };

        const exitCode = await executeCrawl(url, crawlOptions, config.io);
        if (exitCode !== EXIT_CODES.SUCCESS) {
          process.exitCode = exitCode;
        }
      },
    );

  return program;
}
