import type { AccessibilityReport } from '@a11yfix/core';
import { describe, expect, it } from 'vitest';

import { ReporterError } from './errors.js';
import { renderHtmlReport } from './html.js';

const CLEAN_REPORT: AccessibilityReport = {
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
    passes: 42,
    incomplete: 1,
    inapplicable: 15,
  },
  meta: {
    requestedUrl: 'https://clean-example.com',
    finalUrl: 'https://clean-example.com/',
    title: 'Clean Website',
    scannedAt: '2026-09-08T12:00:00.000Z',
  },
};

const VIOLATIONS_REPORT: AccessibilityReport = {
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
          target: ['header > img.logo'],
          failureSummary:
            'Fix any of the following:\n  Element does not have an alt attribute',
        },
      ],
      nodeCount: 1,
      remediation: {
        summary: 'Images must have alternate text',
        details:
          'Fix any of the following:\n  Element does not have an alt attribute',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      },
    },
    {
      ruleId: 'region',
      severity: 'moderate',
      wcag: {
        criteria: [],
        level: null,
        version: null,
        isBestPractice: true,
      },
      description: 'All page content should be contained by landmarks',
      help: 'All page content should be contained by landmarks',
      nodes: [
        {
          html: '<div>Some orphan text</div>',
          target: ['body > div:nth-child(2)'],
          failureSummary: 'Some page content is not contained by landmarks',
        },
      ],
      nodeCount: 1,
      remediation: {
        summary: 'All page content should be contained by landmarks',
        details: 'Some page content is not contained by landmarks',
        helpUrl: '',
      },
    },
  ],
  score: 75,
  grade: 'C',
  breakdown: {
    totalPenalty: 25,
    countsBySeverity: { critical: 1, serious: 0, moderate: 1, minor: 0 },
    scoredFindings: 1,
    bestPracticeFindings: 1,
  },
  ruleCounts: {
    violations: 2,
    passes: 30,
    incomplete: 2,
    inapplicable: 10,
  },
  meta: {
    requestedUrl: 'https://violations-example.com',
    finalUrl: 'https://violations-example.com/',
    title: 'Site with Issues',
    scannedAt: '2026-09-08T14:30:00.000Z',
  },
};

describe('renderHtmlReport', () => {
  it('renders clean scan state when there are no violations', () => {
    const html = renderHtmlReport(CLEAN_REPORT);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Clean Website</title>');
    expect(html).toContain('Clean Scan!');
    expect(html).toContain(
      'No accessibility violations were detected on this page.',
    );
    expect(html).toContain('Grade A');
    expect(html).toContain('100');
    expect(html).not.toContain('Violations (');
  });

  it('renders violations and findings details correctly', () => {
    const html = renderHtmlReport(VIOLATIONS_REPORT);

    expect(html).toContain('Violations (2)');
    expect(html).toContain('image-alt');
    expect(html).toContain('critical');
    expect(html).toContain('WCAG 2.0 A');
    expect(html).toContain('1.1.1');
    expect(html).toContain(
      'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    );
    expect(html).toContain('header &gt; img.logo');
    expect(html).toContain('&lt;img src=&quot;logo.png&quot;&gt;');
    expect(html).toContain('Best Practice');
    expect(html).toContain('Grade C');
    expect(html).toContain('75');
  });

  it('supports custom title option', () => {
    const html = renderHtmlReport(CLEAN_REPORT, {
      title: 'Custom Audit Title',
    });

    expect(html).toContain('<title>Custom Audit Title</title>');
    expect(html).toContain('<h1>Custom Audit Title</h1>');
  });

  it('strictly escapes untrusted inputs to prevent XSS', () => {
    const maliciousReport: AccessibilityReport = {
      ...CLEAN_REPORT,
      findings: [
        {
          ruleId: '<script>alert("xss-rule")</script>',
          severity: 'critical',
          wcag: {
            criteria: ['<img src=x onerror=alert(1)>'],
            level: 'A',
            version: '2.1',
            isBestPractice: false,
          },
          description: '<script>alert("xss-desc")</script>',
          help: '<script>alert("xss-help")</script>',
          nodes: [
            {
              html: '<div onclick="alert(\'xss\')"><script>alert(1)</script></div>',
              target: ['<script>evil()</script>'],
              failureSummary: '<script>alert("fail")</script>',
            },
          ],
          nodeCount: 1,
          remediation: {
            summary: '<script>alert("remedy")</script>',
            details: 'malicious details',
            helpUrl: 'javascript:alert(1)',
          },
        },
      ],
      meta: {
        requestedUrl: 'https://evil.com/" onmouseover="alert(1)',
        finalUrl: null,
        title: '<script>alert("xss-title")</script>',
        scannedAt: '"><script>alert(2)</script>',
      },
    };

    const html = renderHtmlReport(maliciousReport);

    expect(html).not.toContain('<script>alert(');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<script>evil()');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss-rule&quot;)&lt;/script&gt;',
    );
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss-title&quot;)&lt;/script&gt;',
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain(
      '&lt;div onclick=&quot;alert(&#39;xss&#39;)&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;/div&gt;',
    );
  });

  it('throws ReporterError for invalid report', () => {
    expect(() => renderHtmlReport({} as never)).toThrow(ReporterError);
  });
});
