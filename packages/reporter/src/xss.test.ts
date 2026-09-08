import type { AccessibilityReport } from '@a11yfix/core';
import { describe, expect, it } from 'vitest';

import { renderHtmlReport } from './html.js';

describe('HTML reporter XSS penetration tests', () => {
  const XSS_PAYLOAD = '<script>alert("pwned")</script>';
  const ONERROR_PAYLOAD =
    '<img src="invalid" onerror="alert(document.cookie)">';
  const JAVASCRIPT_URL = 'javascript:alert(document.domain)';
  const QUOTE_ATTR_PAYLOAD = '"><script>alert(1)</script><span class="';

  it('neutralizes XSS payloads in scan metadata (title, URLs, timestamp)', () => {
    const maliciousReport: AccessibilityReport = {
      findings: [],
      score: 100,
      grade: 'A',
      breakdown: {
        totalPenalty: 0,
        countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        scoredFindings: 0,
        bestPracticeFindings: 0,
      },
      ruleCounts: { violations: 0, passes: 1, incomplete: 0, inapplicable: 0 },
      meta: {
        requestedUrl: JAVASCRIPT_URL,
        finalUrl: `https://example.com/search?q=${QUOTE_ATTR_PAYLOAD}`,
        title: `Test Page ${XSS_PAYLOAD} ${ONERROR_PAYLOAD}`,
        scannedAt: `2026-09-08"${XSS_PAYLOAD}`,
      },
    };

    const html = renderHtmlReport(maliciousReport);

    // Unsafe protocol in requestedUrl should not be rendered as an active href
    expect(html).not.toContain(`href="${JAVASCRIPT_URL}"`);
    expect(html).toContain('javascript:alert(document.domain)');

    // Raw script and onerror tags must never be present
    expect(html).not.toContain('<script>alert("pwned")</script>');
    expect(html).not.toContain('<img src="invalid" onerror=');

    // Escaped entities must be present
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;',
    );
    expect(html).toContain(
      '&lt;img src=&quot;invalid&quot; onerror=&quot;alert(document.cookie)&quot;&gt;',
    );
  });

  it('neutralizes XSS in options title', () => {
    const report: AccessibilityReport = {
      findings: [],
      score: 100,
      grade: 'A',
      breakdown: {
        totalPenalty: 0,
        countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
        scoredFindings: 0,
        bestPracticeFindings: 0,
      },
      ruleCounts: { violations: 0, passes: 1, incomplete: 0, inapplicable: 0 },
      meta: {
        requestedUrl: null,
        finalUrl: null,
        title: null,
        scannedAt: null,
      },
    };

    const html = renderHtmlReport(report, {
      title: `Custom Title ${XSS_PAYLOAD}`,
    });

    expect(html).not.toContain('<script>alert("pwned")</script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;',
    );
  });

  it('neutralizes XSS payloads in rule descriptions, help texts, and summaries', () => {
    const maliciousReport: AccessibilityReport = {
      findings: [
        {
          ruleId: `rule-${XSS_PAYLOAD}`,
          severity: 'critical',
          nodeCount: 1,
          description: `Description ${ONERROR_PAYLOAD}`,
          help: `Help ${XSS_PAYLOAD}`,
          wcag: {
            criteria: [`1.1.1${XSS_PAYLOAD}`],
            level: 'A',
            version: '2.1',
            isBestPractice: false,
          },
          remediation: {
            summary: `Remediation summary ${XSS_PAYLOAD}`,
            helpUrl: JAVASCRIPT_URL,
            details: `Advice ${XSS_PAYLOAD}`,
          },
          nodes: [
            {
              html: `<input type="text" value="${QUOTE_ATTR_PAYLOAD}">`,
              target: [`div > ${XSS_PAYLOAD}`, ONERROR_PAYLOAD],
              failureSummary: `Fix ${XSS_PAYLOAD}`,
            },
          ],
        },
      ],
      score: 90,
      grade: 'A',
      breakdown: {
        totalPenalty: 10,
        countsBySeverity: { critical: 1, serious: 0, moderate: 0, minor: 0 },
        scoredFindings: 1,
        bestPracticeFindings: 0,
      },
      ruleCounts: { violations: 1, passes: 0, incomplete: 0, inapplicable: 0 },
      meta: {
        requestedUrl: null,
        finalUrl: null,
        title: null,
        scannedAt: null,
      },
    };

    const html = renderHtmlReport(maliciousReport);

    // Assert no unescaped HTML tags or event handlers
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    expect(html).not.toContain('<img');

    // Assert properly entity-escaped text
    expect(html).toContain('&lt;img src=&quot;invalid&quot; onerror=');

    // Assert remediation unsafe help URL is not rendered as an active link
    expect(html).not.toContain(`href="${JAVASCRIPT_URL}"`);

    // Target selector array is safely escaped
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt;',
    );

    // HTML snippet rendered inside <pre><code> is escaped text
    expect(html).toContain('&lt;input type=&quot;text&quot; value=&quot;');
  });
});
