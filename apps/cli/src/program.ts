/**
 * Commander CLI program setup and action wiring for `@a11yfix/cli`.
 */

import { Command, InvalidArgumentError } from 'commander';

import { executeScan } from './scan.js';
import { type CliIo, EXIT_CODES, type ScanCommandOptions } from './types.js';

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
    .option('-o, --output <path>', 'file path to save report (json or html)')
    .option('-f, --format <format>', 'report format (json or html)')
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

  return program;
}
