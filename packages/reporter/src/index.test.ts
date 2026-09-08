import { describe, expect, it } from 'vitest';

import {
  REPORTER_ERROR_CODES,
  ReporterError,
  escapeAttribute,
  escapeHtml,
  isReporterError,
  renderHtmlReport,
  renderJsonReport,
  validateReport,
  writeReport,
} from './index.js';

describe('@a11yfix/reporter public API', () => {
  it('exposes all core report generation and export functions', () => {
    expect(typeof renderJsonReport).toBe('function');
    expect(typeof renderHtmlReport).toBe('function');
    expect(typeof writeReport).toBe('function');
    expect(typeof validateReport).toBe('function');
    expect(typeof escapeHtml).toBe('function');
    expect(typeof escapeAttribute).toBe('function');
  });

  it('exposes error model and guards', () => {
    expect(REPORTER_ERROR_CODES).toContain('INVALID_REPORT');
    expect(REPORTER_ERROR_CODES).toContain('UNSUPPORTED_FORMAT');
    expect(REPORTER_ERROR_CODES).toContain('FILE_WRITE_FAILED');
    expect(typeof ReporterError).toBe('function');
    expect(typeof isReporterError).toBe('function');
  });
});
