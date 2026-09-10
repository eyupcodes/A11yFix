import { readFile } from 'node:fs/promises';

import type { AccessibilityReport } from '@a11yfix/core';
import { analyzeAxeResults } from '@a11yfix/core';
import { renderJsonReport, writeReport } from '@a11yfix/reporter';
import { scanAccessibility, ScannerError } from '@a11yfix/scanner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { executeScan } from './scan.js';
import { type CliIo, EXIT_CODES } from './types.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

vi.mock('@a11yfix/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/scanner')>();
  return {
    ...actual,
    scanAccessibility: vi.fn(),
  };
});

vi.mock('@a11yfix/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/core')>();
  return {
    ...actual,
    analyzeAxeResults: vi.fn(),
  };
});

vi.mock('@a11yfix/reporter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/reporter')>();
  return {
    ...actual,
    writeReport: vi.fn(),
    renderJsonReport: vi.fn(),
  };
});

const MOCK_REPORT: AccessibilityReport = {
  findings: [],
  score: 95,
  grade: 'A',
  breakdown: {
    totalPenalty: 5,
    countsBySeverity: { critical: 0, serious: 0, moderate: 1, minor: 0 },
    scoredFindings: 1,
    bestPracticeFindings: 0,
  },
  ruleCounts: {
    violations: 1,
    passes: 10,
    incomplete: 0,
    inapplicable: 5,
  },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example',
    scannedAt: '2026-09-08T12:00:00.000Z',
  },
};

describe('executeScan', () => {
  let stdoutLogs: string[];
  let stderrLogs: string[];
  let testIo: CliIo;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutLogs = [];
    stderrLogs = [];
    testIo = {
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    };

    vi.mocked(scanAccessibility).mockResolvedValue({
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example',
      scannedAt: '2026-09-08T12:00:00.000Z',
      durationMs: 120,
      axe: {
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
      } as never,
    });

    vi.mocked(analyzeAxeResults).mockReturnValue(MOCK_REPORT);
    vi.mocked(renderJsonReport).mockReturnValue('{"score":95}');
    vi.mocked(writeReport).mockResolvedValue(undefined);
  });

  it('runs scan and returns SUCCESS with terminal summary', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { timeout: 12000 },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(scanAccessibility).toHaveBeenCalledWith('https://example.com', {
      navigationTimeoutMs: 12000,
    });
    expect(analyzeAxeResults).toHaveBeenCalled();
    expect(stdoutLogs.join('\n')).toContain(
      'A11yFix Accessibility Audit Report',
    );
    expect(stdoutLogs.join('\n')).toContain('Score:       95/100 (Grade A)');
  });

  it('outputs JSON when --json flag is set', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { json: true },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(renderJsonReport).toHaveBeenCalledWith(MOCK_REPORT, {
      pretty: true,
    });
    expect(stdoutLogs).toEqual(['{"score":95}']);
  });

  it('suppresses stdout when --quiet flag is set', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { quiet: true },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdoutLogs).toHaveLength(0);
  });

  it('writes report to disk when output option is specified', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { output: 'reports/audit.html', format: 'html' },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(writeReport).toHaveBeenCalledWith(
      MOCK_REPORT,
      'reports/audit.html',
      { format: 'html' },
    );
  });

  it('writes SARIF report to disk when format is sarif', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { output: 'reports/results.sarif', format: 'sarif' },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(writeReport).toHaveBeenCalledWith(
      MOCK_REPORT,
      'reports/results.sarif',
      { format: 'sarif' },
    );
  });

  it('returns SUCCESS when score meets threshold', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { threshold: 90 },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdoutLogs.join('\n')).toContain(
      '✔ PASS: Score 95 meets threshold 90',
    );
  });

  it('returns FAILURE when score is below threshold', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { threshold: 98 },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.FAILURE);
    expect(stdoutLogs.join('\n')).toContain(
      '✖ FAIL: Score 95 is below threshold 98',
    );
  });

  it('validates threshold and returns INVALID_ARGS for out-of-range value', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { threshold: 150 },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_THRESHOLD');
    expect(scanAccessibility).not.toHaveBeenCalled();
  });

  it('validates timeout and returns INVALID_ARGS for non-positive value', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { timeout: -500 },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_TIMEOUT');
    expect(scanAccessibility).not.toHaveBeenCalled();
  });

  it('validates format and returns INVALID_ARGS for unsupported format', async () => {
    const exitCode = await executeScan(
      'https://example.com',
      { format: 'csv' as never },
      testIo,
    );

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain('INVALID_FORMAT');
    expect(scanAccessibility).not.toHaveBeenCalled();
  });

  it('returns INVALID_ARGS when scanner throws INVALID_URL', async () => {
    vi.mocked(scanAccessibility).mockRejectedValue(
      new ScannerError('INVALID_URL', 'Protocol must be http: or https:'),
    );

    const exitCode = await executeScan('ftp://invalid', {}, testIo);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(stderrLogs.join('\n')).toContain(
      'Error [INVALID_URL]: Protocol must be http: or https:',
    );
  });

  it('returns FAILURE on general scanner execution failure', async () => {
    vi.mocked(scanAccessibility).mockRejectedValue(
      new ScannerError('NAVIGATION_FAILED', 'Navigation timed out'),
    );

    const exitCode = await executeScan('https://timeout.com', {}, testIo);

    expect(exitCode).toBe(EXIT_CODES.FAILURE);
    expect(stderrLogs.join('\n')).toContain(
      'Error [NAVIGATION_FAILED]: Navigation timed out',
    );
  });

  describe('baseline regression tracking', () => {
    it('returns INVALID_ARGS when --fail-on-regression is used without --baseline', async () => {
      const exitCode = await executeScan(
        'https://example.com',
        { failOnRegression: true },
        testIo,
      );

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(stderrLogs.join('\n')).toContain(
        '--fail-on-regression requires a baseline report',
      );
    });

    it('returns INVALID_ARGS when baseline file does not exist', async () => {
      vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));

      const exitCode = await executeScan(
        'https://example.com',
        { baseline: 'nonexistent.json' },
        testIo,
      );

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(stderrLogs.join('\n')).toContain('INVALID_BASELINE');
    });

    it('returns INVALID_ARGS when baseline file is not valid JSON', async () => {
      vi.mocked(readFile).mockResolvedValue('not json {[');

      const exitCode = await executeScan(
        'https://example.com',
        { baseline: 'corrupt.json' },
        testIo,
      );

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(stderrLogs.join('\n')).toContain('INVALID_BASELINE');
    });

    it('outputs diff summary and succeeds when baseline matches current', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(MOCK_REPORT));

      const exitCode = await executeScan(
        'https://example.com',
        { baseline: 'baseline.json' },
        testIo,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdoutLogs.join('\n')).toContain(
        'A11yFix Accessibility Regression Diff Report',
      );
      expect(stdoutLogs.join('\n')).toContain('UNCHANGED');
      expect(stdoutLogs.join('\n')).toContain('No new regressions detected.');
    });

    it('returns FAILURE with --fail-on-regression when new violations are introduced', async () => {
      // Baseline had 0 findings, current has 1 finding
      const cleanBaseline = {
        ...MOCK_REPORT,
        findings: [],
        score: 100,
        breakdown: { ...MOCK_REPORT.breakdown, totalPenalty: 0 },
      };
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(cleanBaseline));

      const currentWithFinding = {
        ...MOCK_REPORT,
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
            nodes: [{ html: '<img>', target: ['img'], failureSummary: null }],
            nodeCount: 1,
            remediation: { summary: 'Add alt', details: '', helpUrl: '' },
          },
        ],
        score: 85,
      };
      vi.mocked(analyzeAxeResults).mockReturnValue(currentWithFinding);

      const exitCode = await executeScan(
        'https://example.com',
        { baseline: 'clean.json', failOnRegression: true },
        testIo,
      );

      expect(exitCode).toBe(EXIT_CODES.FAILURE);
      expect(stdoutLogs.join('\n')).toContain('REGRESSION GATE FAILED');
      expect(stdoutLogs.join('\n')).toContain('image-alt');
    });

    it('outputs diff JSON when --json flag is passed with baseline', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(MOCK_REPORT));

      const exitCode = await executeScan(
        'https://example.com',
        { baseline: 'baseline.json', json: true },
        testIo,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      const parsed = JSON.parse(stdoutLogs[0]!) as {
        readonly kind: string;
        readonly status: string;
      };
      expect(parsed.kind).toBe('single');
      expect(parsed.status).toBe('UNCHANGED');
    });
  });
});
