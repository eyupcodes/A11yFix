/**
 * Typed error model for the reporter.
 *
 * Callers distinguish failures by `code`, never by parsing messages.
 * The original failure is preserved on `cause` so it stays available
 * for debugging without becoming part of the public error contract.
 */

export const REPORTER_ERROR_CODES = [
  'INVALID_REPORT',
  'UNSUPPORTED_FORMAT',
  'FILE_WRITE_FAILED',
] as const;

export type ReporterErrorCode = (typeof REPORTER_ERROR_CODES)[number];

export class ReporterError extends Error {
  readonly code: ReporterErrorCode;

  constructor(
    code: ReporterErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ReporterError';
    this.code = code;
  }
}

export function isReporterError(value: unknown): value is ReporterError {
  return value instanceof ReporterError;
}
