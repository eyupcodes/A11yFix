import { describe, expect, it } from 'vitest';

import { extractWcag, parseCriterionTag, parseLevelTag } from './wcag.js';

describe('parseCriterionTag', () => {
  const cases: ReadonlyArray<readonly [string, string | null]> = [
    ['wcag111', '1.1.1'],
    ['wcag122', '1.2.2'],
    ['wcag131', '1.3.1'],
    ['wcag1412', '1.4.12'],
    ['wcag244', '2.4.4'],
    ['wcag412', '4.1.2'],
    // Level tags are not criteria.
    ['wcag2a', null],
    ['wcag2aa', null],
    ['wcag21aa', null],
    ['wcag22aa', null],
    ['wcag2aaa', null],
    // The obsolete marker must never parse as a level or criterion.
    ['wcag2a-obsolete', null],
    // Non-WCAG families.
    ['cat.aria', null],
    ['best-practice', null],
    ['section508', null],
    ['section508.22.a', null],
    ['EN-9.4.1.2', null],
    ['RGAA-1.1.2', null],
    ['TT6.a', null],
    ['ACT', null],
    ['experimental', null],
    ['deprecated', null],
    ['review-item', null],
    ['', null],
  ];

  it.each(cases)('parses %s as %s', (tag, expected) => {
    expect(parseCriterionTag(tag)).toBe(expected);
  });
});

describe('parseLevelTag', () => {
  const cases: ReadonlyArray<
    readonly [string, { version: string; level: string } | null]
  > = [
    ['wcag2a', { version: '2.0', level: 'A' }],
    ['wcag2aa', { version: '2.0', level: 'AA' }],
    ['wcag2aaa', { version: '2.0', level: 'AAA' }],
    ['wcag21a', { version: '2.1', level: 'A' }],
    ['wcag21aa', { version: '2.1', level: 'AA' }],
    ['wcag22aa', { version: '2.2', level: 'AA' }],
    ['wcag111', null],
    ['wcag1412', null],
    ['wcag2a-obsolete', null],
    ['best-practice', null],
    ['cat.color', null],
    ['', null],
  ];

  it.each(cases)('parses %s', (tag, expected) => {
    expect(parseLevelTag(tag)).toEqual(expected);
  });
});

describe('extractWcag', () => {
  it('extracts criteria, level and version from a real rule tag set', () => {
    const mapping = extractWcag([
      'cat.text-alternatives',
      'wcag2a',
      'wcag244',
      'wcag412',
      'section508',
      'ACT',
    ]);

    expect(mapping.criteria).toEqual(['2.4.4', '4.1.2']);
    expect(mapping.level).toBe('A');
    expect(mapping.version).toBe('2.0');
    expect(mapping.isBestPractice).toBe(false);
  });

  it('orders multi-digit criteria numerically, not lexicographically', () => {
    const mapping = extractWcag(['wcag1412', 'wcag143', 'wcag141']);

    expect(mapping.criteria).toEqual(['1.4.1', '1.4.3', '1.4.12']);
  });

  it('de-duplicates repeated criteria', () => {
    const mapping = extractWcag(['wcag111', 'wcag111', 'wcag2a']);

    expect(mapping.criteria).toEqual(['1.1.1']);
  });

  it('keeps the highest level when several apply', () => {
    const mapping = extractWcag(['wcag2a', 'wcag22aa']);

    expect(mapping.level).toBe('AA');
    expect(mapping.version).toBe('2.2');
  });

  it('keeps the newest version when levels are equal', () => {
    const mapping = extractWcag(['wcag2aa', 'wcag21aa', 'wcag22aa']);

    expect(mapping.level).toBe('AA');
    expect(mapping.version).toBe('2.2');
  });

  it('flags best-practice rules with no criteria and no level', () => {
    const mapping = extractWcag(['cat.keyboard', 'best-practice']);

    expect(mapping.criteria).toEqual([]);
    expect(mapping.level).toBeNull();
    expect(mapping.version).toBeNull();
    expect(mapping.isBestPractice).toBe(true);
  });

  it('ignores the obsolete marker entirely', () => {
    const mapping = extractWcag(['wcag2a-obsolete', 'cat.keyboard']);

    expect(mapping.criteria).toEqual([]);
    expect(mapping.level).toBeNull();
    expect(mapping.version).toBeNull();
    expect(mapping.isBestPractice).toBe(false);
  });

  it('handles an empty tag list', () => {
    expect(extractWcag([])).toEqual({
      criteria: [],
      level: null,
      version: null,
      isBestPractice: false,
    });
  });
});
