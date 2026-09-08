import { describe, expect, it } from 'vitest';

import { ReporterError } from './errors.js';
import { renderJsonReport } from './json.js';

const MOCK_REPORT = {
  findings: [
    {
      ruleId: 'image-alt',
      severity: 'critical' as const,
      wcag: {
        criteria: ['1.1.1'],
        level: 'A' as const,
        version: '2.0' as const,
        isBestPractice: false,
      },
      description: 'Images must have alternate text',
      help: 'Images must have alternate text',
      nodes: [
        {
          html: '<img src="test.jpg">',
          target: ['img'],
          failureSummary: 'Missing alt attribute',
        },
      ],
      nodeCount: 1,
      remediation: {
        summary: 'Images must have alternate text',
        details: 'Missing alt attribute',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      },
    },
  ],
  score: 90,
  grade: 'A' as const,
  breakdown: {
    totalPenalty: 10,
    countsBySeverity: { critical: 1, serious: 0, moderate: 0, minor: 0 },
    scoredFindings: 1,
    bestPracticeFindings: 0,
  },
  ruleCounts: {
    violations: 1,
    passes: 15,
    incomplete: 0,
    inapplicable: 10,
  },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example Domain',
    scannedAt: '2026-09-08T12:00:00.000Z',
  },
};

describe('renderJsonReport', () => {
  it('renders a compact JSON report by default', () => {
    const json = renderJsonReport(MOCK_REPORT);

    expect(JSON.parse(json)).toEqual(MOCK_REPORT);
    expect(json).not.toContain('\n');
  });

  it('renders pretty-printed JSON when option is set', () => {
    const json = renderJsonReport(MOCK_REPORT, { pretty: true });

    expect(JSON.parse(json)).toEqual(MOCK_REPORT);
    expect(json).toContain('\n  "score": 90');
  });

  it('rejects invalid reports', () => {
    expect(() => renderJsonReport({} as never)).toThrow(ReporterError);
  });
});
