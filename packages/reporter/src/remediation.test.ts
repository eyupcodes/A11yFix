import type { ReportRemediationPlan } from '@a11yfix/core';
import { describe, expect, it } from 'vitest';
import {
  renderRemediationHtmlReport,
  renderRemediationJsonReport,
  ReporterError,
} from './index.js';

const MOCK_PLAN: ReportRemediationPlan = {
  totalViolations: 2,
  remediatedCount: 2,
  framework: 'html',
  provider: 'heuristic',
  generatedAt: '2026-09-10T12:00:00.000Z',
  results: [
    {
      ruleId: 'image-alt',
      description: 'Images must have alternate text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
      patches: [
        {
          ruleId: 'image-alt',
          target: ['img.hero'],
          originalHtml: '<img src="hero.jpg">',
          fixedCode: '<img src="hero.jpg" alt="Hero banner">',
          explanation: 'Added alt attribute',
          framework: 'html',
          confidence: 'high',
          changes: ['Added alt="Hero banner"'],
          diff: '--- a/element\n+++ b/element\n@@ -1 +1 @@\n-<img src="hero.jpg">\n+<img src="hero.jpg" alt="Hero banner">',
        },
      ],
    },
  ],
};

describe('renderRemediationJsonReport', () => {
  it('serializes plan to compact JSON string by default', () => {
    const json = renderRemediationJsonReport(MOCK_PLAN);
    expect(json).not.toContain('\n');
    expect(JSON.parse(json)).toEqual(MOCK_PLAN);
  });

  it('serializes plan to pretty JSON with indentation when pretty option is true', () => {
    const json = renderRemediationJsonReport(MOCK_PLAN, { pretty: true });
    expect(json).toContain('\n  "framework": "html"');
    expect(JSON.parse(json)).toEqual(MOCK_PLAN);
  });

  it('throws ReporterError INVALID_REPORT on invalid plan object', () => {
    expect(() =>
      renderRemediationJsonReport(null as unknown as ReportRemediationPlan),
    ).toThrow(ReporterError);

    expect(() =>
      renderRemediationJsonReport({} as unknown as ReportRemediationPlan),
    ).toThrow(ReporterError);
  });
});

describe('renderRemediationHtmlReport', () => {
  it('renders standalone accessible HTML report', () => {
    const html = renderRemediationHtmlReport(MOCK_PLAN);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(
      '<title>A11yFix Accessibility Remediation Guide (HTML)</title>',
    );
    expect(html).toContain('Framework: HTML');
    expect(html).toContain('Provider: heuristic');
    expect(html).toContain('2 / 2 Violations Fixed');
    expect(html).toContain('image-alt');
    expect(html).toContain('img.hero');
    expect(html).toContain('HIGH CONFIDENCE');
    expect(html).toContain(
      'data-code="&lt;img src=&quot;hero.jpg&quot; alt=&quot;Hero banner&quot;&gt;"',
    );
    expect(html).toContain('View Unified Diff');
  });

  it('escapes potential XSS payloads in code, explanations and URLs', () => {
    const dangerousPlan: ReportRemediationPlan = {
      totalViolations: 1,
      remediatedCount: 1,
      framework: 'react',
      provider: 'custom',
      generatedAt: '2026-09-10T12:00:00.000Z',
      results: [
        {
          ruleId: '<script>alert("xss")</script>',
          description: '<img src=x onerror=alert(1)>',
          helpUrl: 'javascript:alert(1)',
          patches: [
            {
              ruleId: 'test',
              target: ['<svg onload=alert(2)>'],
              originalHtml:
                '<div onclick="steal()">' +
                '<script>evil()</script>' +
                '</div>',
              fixedCode: '<div data-x="" onerror="alert(3)">Fixed</div>',
              explanation: 'Fix with <script>evil()</script>',
              framework: 'react',
              confidence: 'medium',
              changes: ['<b onmouseover=alert(4)>bold</b>'],
              diff: '+<script>alert(5)</script>',
            },
          ],
        },
      ],
    };

    const html = renderRemediationHtmlReport(dangerousPlan);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
    expect(html).not.toContain('href="javascript:alert(1)"');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('throws ReporterError INVALID_REPORT on invalid input', () => {
    expect(() =>
      renderRemediationHtmlReport(null as unknown as ReportRemediationPlan),
    ).toThrow(ReporterError);
  });
});
