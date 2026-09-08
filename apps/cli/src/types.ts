/**
 * Types and constants for `@a11yfix/cli`.
 */

import type { ReportFormat } from '@a11yfix/reporter';

/**
 * Parsed options for the `a11yfix scan` command.
 */
export interface ScanCommandOptions {
  /** File path where the report should be saved. */
  readonly output?: string | undefined;
  /** Report format for file export ('json' or 'html'). */
  readonly format?: ReportFormat | undefined;
  /** Minimum acceptable score (0-100). Fails with exit code 1 if score is lower. */
  readonly threshold?: number | undefined;
  /** Scan timeout in milliseconds. */
  readonly timeout?: number | undefined;
  /** Print raw JSON report to stdout instead of terminal summary. */
  readonly json?: boolean | undefined;
  /** Suppress decorative terminal output. */
  readonly quiet?: boolean | undefined;
}

/**
 * Standard I/O interface for terminal output and testing dependency injection.
 */
export interface CliIo {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

/**
 * Standard exit codes returned by the CLI.
 */
export const EXIT_CODES = {
  /** Scan completed and score meets any specified threshold. */
  SUCCESS: 0,
  /** Scan completed but score was below threshold, or scan execution failed. */
  FAILURE: 1,
  /** Invalid CLI arguments or target URL. */
  INVALID_ARGS: 2,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
