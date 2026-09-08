import { describe, expect, it } from 'vitest';

import { ReporterError } from './errors.js';
import { validateReport } from './validate.js';

const VALID_REPORT = {
  findings: [],
  score: 100,
  grade: 'A',
  breakdown: {
    totalPenalty: 0,
    countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    scoredFindings: 0,
    bestPracticeFindings: 0,
  },
  ruleCounts: {
    violations: 0,
    passes: 10,
    incomplete: 0,
    inapplicable: 5,
  },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example',
    scannedAt: '2026-09-08T00:00:00.000Z',
  },
};

describe('validateReport', () => {
  it('accepts a valid AccessibilityReport', () => {
    expect(() => validateReport(VALID_REPORT)).not.toThrow();
  });

  it('rejects non-object values', () => {
    expect(() => validateReport(null)).toThrow(ReporterError);
    expect(() => validateReport('string')).toThrow(ReporterError);
    expect(() => validateReport(123)).toThrow(ReporterError);
  });

  it('rejects reports with non-array findings', () => {
    expect(() => validateReport({ ...VALID_REPORT, findings: null })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
  });

  it('rejects reports with invalid score', () => {
    expect(() => validateReport({ ...VALID_REPORT, score: -1 })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
    expect(() => validateReport({ ...VALID_REPORT, score: 101 })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
    expect(() => validateReport({ ...VALID_REPORT, score: NaN })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
  });

  it('rejects reports with invalid grade', () => {
    expect(() => validateReport({ ...VALID_REPORT, grade: 'Z' })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
  });

  it('rejects reports with missing or invalid breakdown', () => {
    expect(() => validateReport({ ...VALID_REPORT, breakdown: null })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
    expect(() =>
      validateReport({
        ...VALID_REPORT,
        breakdown: { ...VALID_REPORT.breakdown, totalPenalty: 'none' },
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_REPORT' }));
  });

  it('rejects reports with missing or invalid ruleCounts', () => {
    expect(() => validateReport({ ...VALID_REPORT, ruleCounts: null })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
  });

  it('rejects reports with missing meta', () => {
    expect(() => validateReport({ ...VALID_REPORT, meta: null })).toThrow(
      expect.objectContaining({ code: 'INVALID_REPORT' }),
    );
  });
});
