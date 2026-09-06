import { describe, expect, it } from 'vitest';

import { flattenTarget, normalizeFindings } from './findings.js';
import { parseAxeResults } from './schemas.js';

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
      target: ['img:nth-child(1)'],
      failureSummary:
        'Fix any of the following:\n  Element does not have an alt attribute',
    },
    {
      html: '<img src="b.png">',
      target: ['img:nth-child(2)'],
    },
  ],
};

const COLOR_CONTRAST = {
  id: 'color-contrast',
  impact: 'serious',
  tags: ['cat.color', 'wcag2aa', 'wcag143'],
  description:
    'Ensure foreground and background colors have sufficient contrast',
  help: 'Elements must meet minimum color contrast ratio thresholds',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/color-contrast',
  nodes: [{ html: '<p>hi</p>', target: ['p'] }],
};

const ACCESSKEYS = {
  id: 'accesskeys',
  impact: 'serious',
  tags: ['cat.keyboard', 'best-practice'],
  description: 'Ensure every accesskey attribute value is unique',
  help: 'accesskey attribute value should be unique',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/accesskeys',
  nodes: [{ html: '<a accesskey="x">a</a>', target: ['a'] }],
};

function violations(results: readonly unknown[]) {
  return parseAxeResults({
    violations: results,
    passes: [],
    incomplete: [],
    inapplicable: [],
  });
}

describe('flattenTarget', () => {
  it('passes plain selectors through', () => {
    expect(flattenTarget(['img', 'div > p'])).toEqual(['img', 'div > p']);
  });

  it('flattens nested shadow-DOM paths depth-first', () => {
    expect(flattenTarget([['#host', '#inner'], 'span'])).toEqual([
      '#host',
      '#inner',
      'span',
    ]);
  });

  it('returns empty when there is no usable selector', () => {
    expect(flattenTarget([])).toEqual([]);
  });
});

describe('normalizeFindings', () => {
  it('normalizes a violation into a finding with remediation', () => {
    const findings = normalizeFindings(violations([IMAGE_ALT]));

    expect(findings).toHaveLength(1);
    const finding = findings[0];
    expect(finding?.ruleId).toBe('image-alt');
    expect(finding?.severity).toBe('critical');
    expect(finding?.wcag.criteria).toEqual(['1.1.1']);
    expect(finding?.wcag.level).toBe('A');
    expect(finding?.nodeCount).toBe(2);
    expect(finding?.nodes[0]?.target).toEqual(['img:nth-child(1)']);
    expect(finding?.remediation.summary).toBe(
      'Images must have alternative text',
    );
    expect(finding?.remediation.details).toContain('alt attribute');
    expect(finding?.remediation.helpUrl).toContain('image-alt');
  });

  it('falls back to null details when no node has a summary', () => {
    const findings = normalizeFindings(violations([COLOR_CONTRAST]));

    expect(findings[0]?.remediation.details).toBeNull();
  });

  it('orders by severity desc, node count desc, rule id asc', () => {
    const findings = normalizeFindings(
      violations([COLOR_CONTRAST, ACCESSKEYS, IMAGE_ALT]),
    );

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      'image-alt',
      'accesskeys',
      'color-contrast',
    ]);
  });

  it('breaks severity ties by node count', () => {
    const single = {
      ...COLOR_CONTRAST,
      id: 'a-rule',
      nodes: [{ html: '<p>x</p>', target: ['p'] }],
    };
    const triple = {
      ...COLOR_CONTRAST,
      id: 'b-rule',
      nodes: [
        { html: '<p>1</p>', target: ['p'] },
        { html: '<p>2</p>', target: ['p'] },
        { html: '<p>3</p>', target: ['p'] },
      ],
    };

    const findings = normalizeFindings(violations([single, triple]));

    expect(findings.map((finding) => finding.ruleId)).toEqual([
      'b-rule',
      'a-rule',
    ]);
  });

  it('returns no findings for empty violations', () => {
    expect(
      normalizeFindings(
        parseAxeResults({
          violations: [],
          passes: [],
          incomplete: [],
          inapplicable: [],
        }),
      ),
    ).toEqual([]);
  });

  it('ignores passes, incomplete and inapplicable results', () => {
    const findings = normalizeFindings(
      parseAxeResults({
        violations: [],
        passes: [IMAGE_ALT],
        incomplete: [IMAGE_ALT],
        inapplicable: [IMAGE_ALT],
      }),
    );

    expect(findings).toEqual([]);
  });
});
