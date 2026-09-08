import { describe, expect, it } from 'vitest';

import {
  REPORTER_ERROR_CODES,
  ReporterError,
  isReporterError,
} from './errors.js';

describe('ReporterError', () => {
  it('constructs with code and message and preserves cause', () => {
    const cause = new Error('nested failure');
    const error = new ReporterError(
      'INVALID_REPORT',
      'Input report is not valid.',
      { cause },
    );

    expect(error.name).toBe('ReporterError');
    expect(error.code).toBe('INVALID_REPORT');
    expect(error.message).toBe('Input report is not valid.');
    expect(error.cause).toBe(cause);
  });

  it('identifies ReporterError instances via isReporterError guard', () => {
    const error = new ReporterError(
      'UNSUPPORTED_FORMAT',
      'Format is unsupported.',
    );
    expect(isReporterError(error)).toBe(true);
    expect(isReporterError(new Error('regular error'))).toBe(false);
    expect(isReporterError(null)).toBe(false);
    expect(isReporterError({ code: 'UNSUPPORTED_FORMAT' })).toBe(false);
  });

  it('exports frozen list of error codes', () => {
    expect(REPORTER_ERROR_CODES).toEqual([
      'INVALID_REPORT',
      'UNSUPPORTED_FORMAT',
      'FILE_WRITE_FAILED',
    ]);
  });
});
