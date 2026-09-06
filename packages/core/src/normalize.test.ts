import { describe, expect, it } from 'vitest';

import { CoreError } from './errors.js';
import { analyzeAxeResults } from './normalize.js';

const IMAGE_ALT = {
  id: 'image-alt',
  impact: 'critical',
  tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
  description: 'Ensure images have alternative text',
  help: 'Images must have alternative text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
  nodes: [
    {
      html: '<img src="a.png">',
      target: ['img'],
      failureSummary:
        'Fix any of the following:\n  Element does not have an alt attribute',
    },
  ],
};

const COLOR_CONTRAST = {
  id: 'color-contrast',
  impact: 'serious',
  tags: ['cat.color', 'wcag2aa', 'wcag143'],
  description: 'desc',
  help: 'help',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/color-contrast',
  nodes: [{ html: '<p>hi</p>', target: ['p'] }],
};

describe('analyzeAxeResults', () => {
  it('produces a full report from violations', () => {
    const report = analyzeAxeResults(
      {
        violations: [IMAGE_ALT, COLOR_CONTRAST],
        passes: [{ ...IMAGE_ALT, id: 'other-pass' }],
        incomplete: [],
        inapplicable: [{ ...IMAGE_ALT, id: 'other-na' }],
      },
      {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com/',
        title: 'Example',
        scannedAt: '2026-09-06T00:00:00.000Z',
      },
    );

    expect(report.findings.map((finding) => finding.ruleId)).toEqual([
      'image-alt',
      'color-contrast',
    ]);
    // critical 10 × 1 + serious 5 × 1 = 15 → 85 → B.
    expect(report.score).toBe(85);
    expect(report.grade).toBe('B');
    expect(report.breakdown.scoredFindings).toBe(2);
    expect(report.ruleCounts).toEqual({
      violations: 2,
      passes: 1,
      incomplete: 0,
      inapplicable: 1,
    });
    expect(report.meta).toEqual({
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example',
      scannedAt: '2026-09-06T00:00:00.000Z',
    });
  });

  it('produces a perfect report for a clean run without metadata', () => {
    const report = analyzeAxeResults({
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
    });

    expect(report.findings).toEqual([]);
    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
    expect(report.meta).toEqual({
      requestedUrl: null,
      finalUrl: null,
      title: null,
      scannedAt: null,
    });
  });

  it('rejects unusable input with INVALID_AXE_RESULTS', () => {
    try {
      analyzeAxeResults(null);
      expect.unreachable('expected analyzeAxeResults to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CoreError);
      expect((error as CoreError).code).toBe('INVALID_AXE_RESULTS');
    }
  });

  it('returns fresh metadata for each report', () => {
    const input = {
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
    };
    const first = analyzeAxeResults(input);
    const second = analyzeAxeResults(input);

    expect(second.meta).not.toBe(first.meta);
  });

  it('rejects invalid metadata with INVALID_AXE_RESULTS', () => {
    expect(() =>
      analyzeAxeResults(
        { violations: [], passes: [], incomplete: [], inapplicable: [] },
        null as never,
      ),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_AXE_RESULTS' }));
  });

  it('is deterministic across runs', () => {
    const input = {
      violations: [COLOR_CONTRAST, IMAGE_ALT],
      passes: [],
      incomplete: [],
      inapplicable: [],
    };

    const first = analyzeAxeResults(input);
    const second = analyzeAxeResults(input);

    expect(second).toEqual(first);
  });
});
