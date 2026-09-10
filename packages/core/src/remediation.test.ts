import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnthropicRemediationProvider,
  CustomRemediationProvider,
  generateHeuristicFix,
  generateReportRemediationPlan,
  generateUnifiedDiff,
  getRemediationProvider,
  OpenAiRemediationProvider,
} from './index.js';
import type { AccessibilityReport, Finding } from './types.js';

describe('remediation-diff', () => {
  it('returns empty string when original and modified are identical', () => {
    expect(generateUnifiedDiff('<div />', '<div />')).toBe('');
  });

  it('generates standard unified diff for single line changes', () => {
    const diff = generateUnifiedDiff(
      '<img src="test.jpg">',
      '<img src="test.jpg" alt="Test">',
    );
    expect(diff).toContain('--- a/element');
    expect(diff).toContain('+++ b/element');
    expect(diff).toContain('-<img src="test.jpg">');
    expect(diff).toContain('+<img src="test.jpg" alt="Test">');
  });

  it('preserves matching leading and trailing lines', () => {
    const orig = '<div>\n  <span>Hello</span>\n</div>';
    const mod = '<div>\n  <span>World</span>\n</div>';
    const diff = generateUnifiedDiff(orig, mod);
    expect(diff).toContain(' <div>');
    expect(diff).toContain('-  <span>Hello</span>');
    expect(diff).toContain('+  <span>World</span>');
    expect(diff).toContain(' </div>');
  });
});

describe('remediation-heuristics', () => {
  function makeFinding(
    ruleId: string,
    html: string,
    extra: Partial<Finding> = {},
  ): Finding {
    return {
      ruleId,
      severity: 'serious',
      wcag: {
        criteria: ['1.1.1'],
        level: 'A',
        version: '2.0',
        isBestPractice: false,
      },
      description: 'Rule description',
      help: 'Rule help message',
      nodes: [
        { html, target: ['selector'], failureSummary: 'Fix this element' },
      ],
      nodeCount: 1,
      remediation: {
        summary: 'Add accessible attribute',
        details: 'More info',
        helpUrl: 'https://dequeuniversity.com',
      },
      ...extra,
    };
  }

  it('fixes image-alt with contextual keywords and tags', () => {
    const logoFinding = makeFinding(
      'image-alt',
      '<img src="/assets/logo.png">',
    );
    const logoPatch = generateHeuristicFix(logoFinding, logoFinding.nodes[0]!);
    expect(logoPatch.fixedCode).toContain('alt="Company logo"');
    expect(logoPatch.confidence).toBe('high');

    const avatarFinding = makeFinding(
      'image-alt',
      '<img src="/static/user-avatar.jpg">',
    );
    const avatarPatch = generateHeuristicFix(
      avatarFinding,
      avatarFinding.nodes[0]!,
    );
    expect(avatarPatch.fixedCode).toContain('alt="User profile picture"');

    const bannerFinding = makeFinding(
      'image-alt',
      '<img src="/static/hero-banner.jpg">',
    );
    const bannerPatch = generateHeuristicFix(
      bannerFinding,
      bannerFinding.nodes[0]!,
    );
    expect(bannerPatch.fixedCode).toContain('alt="Hero banner"');

    const inputImg = makeFinding(
      'input-image-alt',
      '<input type="image" src="btn.png">',
    );
    const inputPatch = generateHeuristicFix(inputImg, inputImg.nodes[0]!);
    expect(inputPatch.fixedCode).toContain('alt="Submit"');
  });

  it('formats React JSX for image-alt', () => {
    const finding = makeFinding(
      'image-alt',
      '<img class="img-fluid" src="pic.jpg">',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!, 'react');
    expect(patch.fixedCode).toContain('className="img-fluid"');
    expect(patch.fixedCode).toContain('alt="Image description"');
    expect(patch.fixedCode).toContain('/>');
  });

  it('fixes button-name by injecting aria-label', () => {
    const finding = makeFinding(
      'button-name',
      '<button class="icon-btn"><svg></svg></button>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('aria-label="Action description"');
    expect(patch.diff).toContain('+<button aria-label="Action description"');
  });

  it('fixes link-name by injecting aria-label', () => {
    const finding = makeFinding('link-name', '<a href="/cart"><svg></svg></a>');
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('aria-label="Destination description"');
  });

  it('fixes color-contrast by adjusting foreground color', () => {
    const finding = makeFinding(
      'color-contrast',
      '<p style="color: #ccc;">Light gray text</p>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('color: #1a1a1a');
  });

  it('fixes html-has-lang by adding lang attribute', () => {
    const finding = makeFinding('html-has-lang', '<html>');
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toBe('<html lang="en">');
  });

  it('fixes document-title by adding title tag in head', () => {
    const finding = makeFinding(
      'document-title',
      '<head><meta charset="utf-8"></head>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('<title>Descriptive Page Title</title>');
  });

  it('fixes label by associating label element or aria-label', () => {
    const inputWithId = makeFinding(
      'label',
      '<input type="text" id="username">',
    );
    const patch = generateHeuristicFix(inputWithId, inputWithId.nodes[0]!);
    expect(patch.fixedCode).toContain(
      '<label for="username">Input Label</label>',
    );

    const reactPatch = generateHeuristicFix(
      inputWithId,
      inputWithId.nodes[0]!,
      'react',
    );
    expect(reactPatch.fixedCode).toContain('htmlFor="username"');

    const inputWithoutId = makeFinding('label', '<input type="email">');
    const patchNoId = generateHeuristicFix(
      inputWithoutId,
      inputWithoutId.nodes[0]!,
    );
    expect(patchNoId.fixedCode).toContain('aria-label="Input label"');
  });

  it('fixes frame-title by adding title attribute', () => {
    const finding = makeFinding(
      'frame-title',
      '<iframe src="https://maps.google.com"></iframe>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('title="Embedded content description"');
  });

  it('fixes target-blank with rel="noopener noreferrer"', () => {
    const finding = makeFinding(
      'target-blank',
      '<a href="https://example.com" target="_blank">External</a>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('rel="noopener noreferrer"');
  });

  it('fixes aria-hidden-focus by removing aria-hidden attribute', () => {
    const finding = makeFinding(
      'aria-hidden-focus',
      '<button aria-hidden="true">Hidden Focus</button>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).not.toContain('aria-hidden="true"');
  });

  it('fixes duplicate-id by appending -unique suffix', () => {
    const finding = makeFinding(
      'duplicate-id',
      '<div id="header">Header</div>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain('id="header-unique"');
  });

  it('falls back to helpful comment for unknown rules', () => {
    const finding = makeFinding(
      'custom-rule',
      '<div class="widget">Content</div>',
    );
    const patch = generateHeuristicFix(finding, finding.nodes[0]!);
    expect(patch.fixedCode).toContain(
      '<!-- a11yfix [custom-rule]: Fix this element -->',
    );
    expect(patch.confidence).toBe('low');

    const reactPatch = generateHeuristicFix(
      finding,
      finding.nodes[0]!,
      'react',
    );
    expect(reactPatch.fixedCode).toContain(
      '{/* a11yfix [custom-rule]: Fix this element */}',
    );
  });
});

describe('remediation-providers', () => {
  const originalFetch = globalThis.fetch;
  const finding: Finding = {
    ruleId: 'image-alt',
    severity: 'critical',
    wcag: {
      criteria: ['1.1.1'],
      level: 'A',
      version: '2.0',
      isBestPractice: false,
    },
    description: 'Images must have alternate text',
    help: 'Images must have alternate text',
    nodes: [
      { html: '<img src="cat.jpg">', target: ['img'], failureSummary: null },
    ],
    nodeCount: 1,
    remediation: { summary: 'Add alt', details: '', helpUrl: '' },
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env['OPENAI_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];
  });

  it('resolves default HeuristicRemediationProvider', async () => {
    const provider = getRemediationProvider();
    expect(provider.name).toBe('heuristic');
    const patch = await provider.generateFix(finding, finding.nodes[0]!, {});
    expect(patch.fixedCode).toContain('alt="Image description"');
  });

  it('OpenAiRemediationProvider calls API when key provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  fixedCode: '<img src="cat.jpg" alt="A cute cat resting">',
                  explanation: 'Added detailed alt text for image.',
                  changes: ['Added alt attribute'],
                  confidence: 'high',
                }),
              },
            },
          ],
        }),
    });
    globalThis.fetch = mockFetch as never;

    const provider = new OpenAiRemediationProvider();
    const patch = await provider.generateFix(finding, finding.nodes[0]!, {
      apiKey: 'sk-test',
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(patch.fixedCode).toBe(
      '<img src="cat.jpg" alt="A cute cat resting">',
    );
    expect(patch.explanation).toBe('Added detailed alt text for image.');
  });

  it('OpenAiRemediationProvider gracefully falls back to heuristic on failure', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    globalThis.fetch = mockFetch as never;

    const provider = new OpenAiRemediationProvider();
    const patch = await provider.generateFix(finding, finding.nodes[0]!, {
      apiKey: 'sk-test',
    });

    expect(patch.fixedCode).toContain('alt="Image description"');
  });

  it('AnthropicRemediationProvider calls API when key provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [
            {
              text: JSON.stringify({
                fixedCode: '<img src="cat.jpg" alt="Orange tabby cat">',
                explanation: 'Described the cat in alt attribute.',
                changes: ['Added alt'],
                confidence: 'high',
              }),
            },
          ],
        }),
    });
    globalThis.fetch = mockFetch as never;

    const provider = new AnthropicRemediationProvider();
    const patch = await provider.generateFix(finding, finding.nodes[0]!, {
      apiKey: 'anthropic-test-key',
    });

    expect(mockFetch).toHaveBeenCalled();
    expect(patch.fixedCode).toBe('<img src="cat.jpg" alt="Orange tabby cat">');
  });

  it('CustomRemediationProvider calls custom endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  fixedCode: '<img src="cat.jpg" alt="Custom model cat">',
                  explanation: 'Ollama generated fix.',
                  changes: ['Added alt'],
                }),
              },
            },
          ],
        }),
    });
    globalThis.fetch = mockFetch as never;

    const provider = new CustomRemediationProvider();
    const patch = await provider.generateFix(finding, finding.nodes[0]!, {
      endpoint: 'http://localhost:11434/v1/chat/completions',
    });

    expect(patch.fixedCode).toBe('<img src="cat.jpg" alt="Custom model cat">');
  });
});

describe('generateReportRemediationPlan', () => {
  it('generates a multi-rule remediation plan', async () => {
    const report: AccessibilityReport = {
      score: 80,
      grade: 'B',
      findings: [
        {
          ruleId: 'image-alt',
          severity: 'critical',
          wcag: {
            criteria: ['1.1.1'],
            level: 'A',
            version: '2.0',
            isBestPractice: false,
          },
          description: 'Images must have alternate text',
          help: 'Images must have alternate text',
          nodes: [
            {
              html: '<img src="logo.png">',
              target: ['header > img'],
              failureSummary: null,
            },
          ],
          nodeCount: 1,
          remediation: { summary: 'Add alt', details: '', helpUrl: '' },
        },
        {
          ruleId: 'button-name',
          severity: 'serious',
          wcag: {
            criteria: ['4.1.2'],
            level: 'A',
            version: '2.0',
            isBestPractice: false,
          },
          description: 'Buttons must have discernible text',
          help: 'Buttons must have discernible text',
          nodes: [
            {
              html: '<button><svg></svg></button>',
              target: ['button.close'],
              failureSummary: null,
            },
          ],
          nodeCount: 1,
          remediation: { summary: 'Add name', details: '', helpUrl: '' },
        },
      ],
      breakdown: {
        totalPenalty: 20,
        countsBySeverity: { critical: 1, serious: 1, moderate: 0, minor: 0 },
        scoredFindings: 2,
        bestPracticeFindings: 0,
      },
      ruleCounts: {
        violations: 2,
        passes: 15,
        incomplete: 0,
        inapplicable: 10,
      },
      meta: {
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com/',
        title: 'Example',
        scannedAt: '2026-09-10T12:00:00.000Z',
      },
    };

    const plan = await generateReportRemediationPlan(report, {
      framework: 'react',
    });

    expect(plan.framework).toBe('react');
    expect(plan.provider).toBe('heuristic');
    expect(plan.totalViolations).toBe(2);
    expect(plan.remediatedCount).toBe(2);
    expect(plan.results).toHaveLength(2);
    expect(plan.results[0]!.patches[0]!.fixedCode).toContain(
      'alt="Company logo"',
    );
    expect(plan.results[1]!.patches[0]!.fixedCode).toContain(
      'aria-label="Action description"',
    );
  });
});
