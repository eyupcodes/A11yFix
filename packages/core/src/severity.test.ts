import { describe, expect, it } from 'vitest';

import {
  classifySeverity,
  DEFAULT_SEVERITY,
  SEVERITY_WEIGHTS,
  severityWeight,
} from './severity.js';
import type { Severity } from './types.js';

describe('classifySeverity', () => {
  const known: ReadonlyArray<readonly [unknown, Severity]> = [
    ['minor', 'minor'],
    ['moderate', 'moderate'],
    ['serious', 'serious'],
    ['critical', 'critical'],
  ];

  it.each(known)('classifies %s', (impact, expected) => {
    expect(classifySeverity(impact)).toBe(expected);
  });

  const fallback: readonly unknown[] = [
    null,
    undefined,
    '',
    'unknown',
    'CRITICAL',
    5,
    {},
    [],
  ];

  it.each(fallback)('falls back to %s', (impact) => {
    expect(classifySeverity(impact)).toBe(DEFAULT_SEVERITY);
  });

  it('defaults to moderate', () => {
    expect(DEFAULT_SEVERITY).toBe('moderate');
  });
});

describe('severityWeight', () => {
  it('orders weights from minor to critical', () => {
    const severities: readonly Severity[] = [
      'minor',
      'moderate',
      'serious',
      'critical',
    ];

    const weights = severities.map(severityWeight);
    const ordered = [...weights].sort((a, b) => a - b);

    expect(weights).toEqual(ordered);
    expect(new Set(weights).size).toBe(severities.length);
  });

  it('keeps weights positive', () => {
    for (const weight of Object.values(SEVERITY_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
    }
  });
});
