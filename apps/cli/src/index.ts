/**
 * Main entry point for `@a11yfix/cli`.
 */

import { fileURLToPath } from 'node:url';

import { createProgram, type CreateProgramOptions } from './program.js';
import { executeCrawl } from './crawl.js';
import { executeScan } from './scan.js';
import {
  type CliIo,
  type CrawlCommandOptions,
  type ExitCode,
  EXIT_CODES,
  type ScanCommandOptions,
} from './types.js';

export { createProgram, type CreateProgramOptions };
export { executeScan };
export { executeCrawl };
export {
  formatCrawlTerminalSummary,
  formatError,
  formatTerminalSummary,
  type FormatSummaryOptions,
} from './formatters.js';
export {
  type CliIo,
  type CrawlCommandOptions,
  type ExitCode,
  EXIT_CODES,
  type ScanCommandOptions,
};

/**
 * Checks whether the current module was directly invoked as the process entry point.
 */
export function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

/**
 * Runs the CLI with the provided argv arguments.
 */
export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

if (isMainModule()) {
  void run();
}
