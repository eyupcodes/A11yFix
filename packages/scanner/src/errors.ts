/**
 * Typed error model for the scanner.
 *
 * Callers distinguish failures by `code`, never by parsing messages or by
 * inspecting Playwright internals. The original failure is preserved on
 * `cause` so it stays available for debugging without becoming part of the
 * public error contract.
 */

export const SCANNER_ERROR_CODES = [
  'INVALID_URL',
  'UNSUPPORTED_PROTOCOL',
  'PRIVATE_TARGET',
  'BROWSER_LAUNCH_FAILED',
  'NAVIGATION_FAILED',
  'AXE_INJECTION_FAILED',
  'AXE_EXECUTION_FAILED',
  'SCAN_FAILED',
] as const;

export type ScannerErrorCode = (typeof SCANNER_ERROR_CODES)[number];

export class ScannerError extends Error {
  readonly code: ScannerErrorCode;

  constructor(
    code: ScannerErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ScannerError';
    this.code = code;
  }
}

export function isScannerError(value: unknown): value is ScannerError {
  return value instanceof ScannerError;
}

/**
 * Extracts a short, human-readable reason from an unknown thrown value.
 *
 * Playwright errors carry multi-line stack output; only the first line is kept
 * so the public message stays readable.
 */
export function describeCause(cause: unknown): string {
  if (cause instanceof Error) {
    const [firstLine] = cause.message.split('\n');
    return firstLine?.trim() ?? cause.name;
  }

  if (typeof cause === 'string') {
    return cause;
  }

  return 'unknown error';
}
