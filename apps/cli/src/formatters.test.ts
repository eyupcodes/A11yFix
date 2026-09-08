import type { AccessibilityReport } from '@a11yfix/core';
import { describe, expect, it } from 'vitest';

import { formatError, formatTerminalSummary } from './formatters.js';

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
    passes: 15,
    incomplete: 0,
    inapplicable: 10,
  },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Clean Page',
    scannedAt: '2026-09-08T12:00:00.000Z',
  },
};

const VIOLATIONS_REPORT: AccessibilityReport = {
  findings: [
    {
      ruleId: 'image-alt',
      description: 'Images must have alternate text',
      help: 'Images must have alternate text',
      severity: 'critical',
      wcag: {
        criteria: ['1.1.1'],
        level: 'A',
        version: '2.0',
        isBestPractice: false,
      },
      nodes: [],
      nodeCount: 2,
      remediation: {
        summary: 'Add an alt attribute to all <img> elements.',
        details: 'Each img element should have an alt attribute.',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      },
    },
    {
      ruleId: 'region',
      description: 'All page content should be contained by landmarks',
      help: 'All page content should be contained by landmarks',
      severity: 'moderate',
      wcag: {
        criteria: [],
        level: null,
        version: null,
        isBestPractice: true,
      },
      nodes: [],
      nodeCount: 1,
      remediation: {
        summary: 'Ensure all content is contained within landmark elements.',
        details: null,
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
    passes: 10,
    incomplete: 0,
    inapplicable: 5,
  },
  meta: {
    requestedUrl: 'https://broken.example.com',
    finalUrl: 'https://broken.example.com/',
    title: 'Broken Page',
    scannedAt: '2026-09-08T13:00:00.000Z',
  },
};

describe('formatTerminalSummary', () => {
  it('formats a clean scan summary with score and grade', () => {
    const output = formatTerminalSummary(CLEAN_REPORT);

    expect(output).toContain('A11yFix Accessibility Audit Report');
    expect(output).toContain('URL:         https://example.com');
    expect(output).toContain('Title:       Clean Page');
    expect(output).toContain('Score:       100/100 (Grade A)');
    expect(output).toContain('Severity Breakdown:');
    expect(output).toContain('Critical:      0');
    expect(output).toContain(
      '✔ Clean scan! No accessibility violations detected.',
    );
  });

  it('formats scan with findings, WCAG info, and remediation', () => {
    const output = formatTerminalSummary(VIOLATIONS_REPORT);

    expect(output).toContain('Score:       75/100 (Grade C)');
    expect(output).toContain('Violations (2):');
    expect(output).toContain('[CRITICAL] image-alt (WCAG 2.0 A: 1.1.1)');
    expect(output).toContain('Affected elements: 2');
    expect(output).toContain(
      'Remediation: Add an alt attribute to all <img> elements.',
    );
    expect(output).toContain(
      'Docs: https://dequeuniversity.com/rules/axe/4.13/image-alt',
    );
    expect(output).toContain('[MODERATE] region [Best Practice]');
    expect(output).toContain('Best Practice: 1');
  });

  it('renders passing threshold line when score >= threshold', () => {
    const output = formatTerminalSummary(CLEAN_REPORT, { threshold: 90 });

    expect(output).toContain('✔ PASS: Score 100 meets threshold 90');
  });

  it('renders failing threshold line when score < threshold', () => {
    const output = formatTerminalSummary(VIOLATIONS_REPORT, { threshold: 80 });

    expect(output).toContain('✖ FAIL: Score 75 is below threshold 80');
  });
});

describe('formatError', () => {
  it('formats error with code and message', () => {
    const err = { code: 'INVALID_URL', message: 'Target URL is invalid.' };
    expect(formatError(err)).toBe(
      'Error [INVALID_URL]: Target URL is invalid.',
    );
  });

  it('formats standard Error instance without code', () => {
    const err = new Error('Something went wrong');
    expect(formatError(err)).toBe('Error: Something went wrong');
  });

  it('formats primitive error string or number', () => {
    expect(formatError('Network failure')).toBe('Error: Network failure');
    expect(formatError(500)).toBe('Error: 500');
  });
});
