import { describe, expect, it } from 'vitest';

import {
  analyzeAxeResults,
  CORE_ERROR_CODES,
  CoreError,
  isCoreError,
} from './index.js';

describe('@a11yfix/core public API', () => {
  it('exposes the analysis entry point', () => {
    expect(typeof analyzeAxeResults).toBe('function');
  });

  it('exposes the typed error model', () => {
    expect(CORE_ERROR_CODES).toContain('INVALID_AXE_RESULTS');
    expect(isCoreError(new CoreError('INVALID_AXE_RESULTS', 'x'))).toBe(true);
    expect(isCoreError(new Error('x'))).toBe(false);
  });

  it('analyzes an empty run end to end', () => {
    const report = analyzeAxeResults({
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
    });

    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
    expect(report.findings).toEqual([]);
  });
});
