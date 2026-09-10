/**
 * Typed error model for core.
 *
 * Mirrors the scanner convention (`packages/scanner/src/errors.ts`):
 * callers distinguish failures by `code`, never by parsing messages.
 * The original failure is preserved on `cause` so it stays available
 * for debugging without becoming part of the public error contract.
 */

export const CORE_ERROR_CODES = [
  'INVALID_AXE_RESULTS',
  'UNSUPPORTED_AXE_SHAPE',
  'INVALID_REPORT',
] as const;

export type CoreErrorCode = (typeof CORE_ERROR_CODES)[number];

export class CoreError extends Error {
  readonly code: CoreErrorCode;

  constructor(
    code: CoreErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'CoreError';
    this.code = code;
  }
}

export function isCoreError(value: unknown): value is CoreError {
  return value instanceof CoreError;
}
