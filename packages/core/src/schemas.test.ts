import { describe, expect, it } from 'vitest';

import { CoreError } from './errors.js';
import { axeResultsSchema, parseAxeResults } from './schemas.js';

const MINIMAL_NODE = {
  html: '<img src="logo.png">',
  target: ['img'],
};

const MINIMAL_RESULT = {
  id: 'image-alt',
  impact: 'critical',
  tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
  description: 'Ensure images have alternative text',
  help: 'Images must have alternative text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
  nodes: [MINIMAL_NODE],
};

const EMPTY_RESULTS = {
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: [],
};

describe('axeResultsSchema', () => {
  it('accepts a minimal valid results object', () => {
    const parsed = axeResultsSchema.safeParse({
      ...EMPTY_RESULTS,
      violations: [MINIMAL_RESULT],
    });

    expect(parsed.success).toBe(true);
  });

  it('requires every result group', () => {
    expect(() =>
      axeResultsSchema.parse({ violations: [MINIMAL_RESULT] }),
    ).toThrow();
  });

  it('strips unknown fields instead of retaining untrusted data', () => {
    const parsed = axeResultsSchema.parse({
      ...EMPTY_RESULTS,
      toolOptions: { reporter: 'v2' },
      someFutureField: { nested: true },
    });

    expect(parsed).not.toHaveProperty('toolOptions');
    expect(parsed).not.toHaveProperty('someFutureField');
  });

  it('accepts nodes without a failure summary', () => {
    const parsed = axeResultsSchema.parse({
      ...EMPTY_RESULTS,
      violations: [MINIMAL_RESULT],
    });

    expect(parsed.violations[0]?.nodes[0]?.failureSummary).toBeUndefined();
  });

  it('rejects an empty object instead of treating it as a clean run', () => {
    expect(() => parseAxeResults({})).toThrowError(
      expect.objectContaining({ code: 'INVALID_AXE_RESULTS' }),
    );
  });

  it('rejects oversized strings and collections', () => {
    expect(() =>
      parseAxeResults({
        ...EMPTY_RESULTS,
        violations: [
          {
            ...MINIMAL_RESULT,
            description: 'x'.repeat(100_001),
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_AXE_RESULTS' }));

    expect(() =>
      parseAxeResults({
        ...EMPTY_RESULTS,
        violations: [
          {
            ...MINIMAL_RESULT,
            tags: Array.from({ length: 101 }, () => 'wcag111'),
          },
        ],
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_AXE_RESULTS' }));
  });
});

describe('parseAxeResults', () => {
  it('returns the parsed form for valid input', () => {
    const results = parseAxeResults({
      ...EMPTY_RESULTS,
      violations: [MINIMAL_RESULT],
    });

    expect(results.violations).toHaveLength(1);
    expect(results.violations[0]?.id).toBe('image-alt');
  });

  const invalid: ReadonlyArray<readonly [string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not results'],
    ['a number', 42],
    ['an array', []],
    ['violations not an array', { ...EMPTY_RESULTS, violations: {} }],
    [
      'result missing required fields',
      { ...EMPTY_RESULTS, violations: [{ id: 'image-alt' }] },
    ],
    [
      'node missing html',
      {
        ...EMPTY_RESULTS,
        violations: [{ ...MINIMAL_RESULT, nodes: [{ target: ['img'] }] }],
      },
    ],
    [
      'non-string tags',
      {
        ...EMPTY_RESULTS,
        violations: [{ ...MINIMAL_RESULT, tags: ['wcag2a', 7] }],
      },
    ],
  ];

  it.each(invalid)('rejects %s with INVALID_AXE_RESULTS', (_label, input) => {
    try {
      parseAxeResults(input);
      expect.unreachable('expected parseAxeResults to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreError);
      expect((error as CoreError).code).toBe('INVALID_AXE_RESULTS');
    }
  });
});
