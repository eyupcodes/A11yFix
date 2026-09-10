import { mkdir, readFile, writeFile } from 'node:fs/promises';

import type { AccessibilityReport, ReportRemediationPlan } from '@a11yfix/core';
import {
  analyzeAxeResults,
  generateReportRemediationPlan,
} from '@a11yfix/core';
import {
  renderRemediationHtmlReport,
  renderRemediationJsonReport,
} from '@a11yfix/reporter';
import { scanAccessibility, ScannerError } from '@a11yfix/scanner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from './program.js';
import { executeRemediate } from './remediate.js';
import { type CliIo, EXIT_CODES } from './types.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
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
    generateReportRemediationPlan: vi.fn(),
  };
});

vi.mock('@a11yfix/reporter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/reporter')>();
  return {
    ...actual,
    renderRemediationHtmlReport: vi.fn(),
    renderRemediationJsonReport: vi.fn(),
  };
});

const MOCK_REPORT: AccessibilityReport = {
  findings: [
    {
      ruleId: 'image-alt',
      description: 'Images must have alternate text',
      severity: 'critical',
      help: 'Images must have alternate text',
      nodeCount: 1,
      nodes: [
        {
          target: ['img.banner'],
          html: '<img src="banner.png">',
          failureSummary: 'Element does not have an alt attribute',
        },
      ],
      wcag: {
        criteria: ['1.1.1'],
        level: 'A',
        version: '2.1',
        isBestPractice: false,
      },
      remediation: {
        summary: 'Add alt attribute',
        details: null,
        helpUrl: 'https://example.com/help',
      },
    },
  ],
  score: 75,
  grade: 'C',
  breakdown: {
    totalPenalty: 25,
    countsBySeverity: { critical: 1, serious: 0, moderate: 0, minor: 0 },
    scoredFindings: 1,
    bestPracticeFindings: 0,
  },
  ruleCounts: {
    violations: 1,
    passes: 0,
    incomplete: 0,
    inapplicable: 0,
  },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    scannedAt: '2026-09-10T12:00:00.000Z',
    title: 'Example',
  },
};

const MOCK_PLAN: ReportRemediationPlan = {
  totalViolations: 1,
  remediatedCount: 1,
  framework: 'html',
  provider: 'heuristic',
  generatedAt: '2026-09-10T12:00:00.000Z',
  results: [
    {
      ruleId: 'image-alt',
      description: 'Images must have alternate text',
      helpUrl: 'https://example.com/help',
      patches: [
        {
          ruleId: 'image-alt',
          target: ['img.banner'],
          originalHtml: '<img src="banner.png">',
          fixedCode: '<img src="banner.png" alt="Banner">',
          explanation: 'Added alt attribute',
          framework: 'html',
          confidence: 'high',
          changes: ['Added alt="Banner"'],
          diff: '--- a/element\n+++ b/element\n@@ -1 +1 @@\n-<img src="banner.png">\n+<img src="banner.png" alt="Banner">',
        },
      ],
    },
  ],
};

function createMockIo(): CliIo & {
  stdoutOutput: string[];
  stderrOutput: string[];
} {
  const stdoutOutput: string[] = [];
  const stderrOutput: string[] = [];
  return {
    stdout: (msg: string) => {
      stdoutOutput.push(msg);
    },
    stderr: (msg: string) => {
      stderrOutput.push(msg);
    },
    stdoutOutput,
    stderrOutput,
  };
}

describe('executeRemediate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateReportRemediationPlan).mockResolvedValue(MOCK_PLAN);
    vi.mocked(renderRemediationJsonReport).mockReturnValue(
      JSON.stringify(MOCK_PLAN),
    );
    vi.mocked(renderRemediationHtmlReport).mockReturnValue(
      '<!DOCTYPE html><html><body>Remediation Report</body></html>',
    );
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(MOCK_REPORT));
  });

  it('validates invalid framework argument', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate(
      'report.json',
      { framework: 'angular' as never },
      io,
    );
    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(io.stderrOutput.join('')).toContain('Invalid framework "angular"');
  });

  it('validates invalid provider argument', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate(
      'report.json',
      { provider: 'gemini' as never },
      io,
    );
    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(io.stderrOutput.join('')).toContain('Invalid provider "gemini"');
  });

  it('validates invalid format argument', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate(
      'report.json',
      { format: 'csv' as never },
      io,
    );
    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(io.stderrOutput.join('')).toContain('Invalid format "csv"');
  });

  it('remediates from local report file and prints terminal summary', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate('report.json', {}, io);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(readFile).toHaveBeenCalledWith('report.json', 'utf-8');
    expect(generateReportRemediationPlan).toHaveBeenCalledWith(
      MOCK_REPORT,
      expect.objectContaining({ framework: 'html' }),
    );
    expect(io.stdoutOutput.join('\n')).toContain('Remediation Suggestions');
    expect(io.stdoutOutput.join('\n')).toContain('image-alt');
  });

  it('remediates with --diff flag displaying unified diff', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate('report.json', { diff: true }, io);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(io.stdoutOutput.join('\n')).toContain('Diff:');
    expect(io.stdoutOutput.join('\n')).toContain(
      '+<img src="banner.png" alt="Banner">',
    );
  });

  it('remediates from live web URL', async () => {
    const io = createMockIo();
    const mockAxe = { testEngine: { name: 'axe-core' } };
    const mockScanResult = {
      axe: mockAxe,
      url: 'https://example.com',
      scannedAt: '2026-09-10T12:00:00.000Z',
      durationMs: 150,
      title: 'Example',
    };
    vi.mocked(scanAccessibility).mockResolvedValue(mockScanResult as never);
    vi.mocked(analyzeAxeResults).mockReturnValue(MOCK_REPORT);

    const exitCode = await executeRemediate('https://example.com', {}, io);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(scanAccessibility).toHaveBeenCalledWith('https://example.com');
    expect(analyzeAxeResults).toHaveBeenCalledWith(mockAxe, mockScanResult);
  });

  it('outputs raw JSON when --json flag is set', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate('report.json', { json: true }, io);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(renderRemediationJsonReport).toHaveBeenCalledWith(MOCK_PLAN, {
      pretty: true,
    });
    expect(io.stdoutOutput[0]).toBe(JSON.stringify(MOCK_PLAN));
  });

  it('writes remediation plan to file with -o flag', async () => {
    const io = createMockIo();
    const exitCode = await executeRemediate(
      'report.json',
      { output: 'out/plan.html', format: 'html' },
      io,
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(mkdir).toHaveBeenCalledWith('out', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      'out/plan.html',
      '<!DOCTYPE html><html><body>Remediation Report</body></html>',
      'utf-8',
    );
  });

  it('returns INVALID_ARGS on non-existent file', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));
    const io = createMockIo();
    const exitCode = await executeRemediate('missing.json', {}, io);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(io.stderrOutput.join('')).toContain(
      'Cannot read accessibility report file',
    );
  });

  it('returns INVALID_ARGS on malformed JSON file', async () => {
    vi.mocked(readFile).mockResolvedValue('invalid json content');
    const io = createMockIo();
    const exitCode = await executeRemediate('bad.json', {}, io);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(io.stderrOutput.join('')).toContain('File is not valid JSON');
  });

  it('returns INVALID_ARGS when ScannerError INVALID_URL is thrown', async () => {
    vi.mocked(scanAccessibility).mockRejectedValue(
      new ScannerError('INVALID_URL', 'Invalid URL provided'),
    );
    const io = createMockIo();
    const exitCode = await executeRemediate('http://bad url', {}, io);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(io.stderrOutput.join('')).toContain('INVALID_URL');
  });
});

describe('Commander CLI remediate command wiring', () => {
  it('wires remediate command with expected options', () => {
    const io = createMockIo();
    const program = createProgram({ io, exitOverride: true });
    const cmd = program.commands.find((c) => c.name() === 'remediate');

    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('remediation');
  });
});
