import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { AccessibilityReport } from '@a11yfix/core';
import { scanAccessibility } from '@a11yfix/scanner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from './program.js';
import { type CliIo, EXIT_CODES } from './types.js';

vi.mock('@a11yfix/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@a11yfix/scanner')>();
  return {
    ...actual,
    scanAccessibility: vi.fn(),
  };
});

const MOCK_AXE_RESULTS = {
  violations: [
    {
      id: 'image-alt',
      impact: 'critical',
      tags: ['wcag2a', 'wcag111', 'cat.text-alternatives'],
      description: 'Ensure images have alt text',
      help: 'Images must have alt text',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
      nodes: [
        {
          html: '<img src="logo.png">',
          target: ['#logo'],
          failureSummary: 'Element does not have an alt attribute',
        },
      ],
    },
    {
      id: 'color-contrast',
      impact: 'serious',
      tags: ['wcag2aa', 'wcag143', 'cat.color'],
      description: 'Ensure text contrast meets WCAG threshold',
      help: 'Elements must have sufficient color contrast',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/color-contrast',
      nodes: [
        {
          html: '<p style="color: #ccc; background: #fff">Faint text</p>',
          target: ['p.faint'],
          failureSummary: 'Element has insufficient color contrast of 1.6:1',
        },
      ],
    },
  ],
  passes: [
    {
      id: 'document-title',
      impact: 'serious',
      tags: ['wcag2a', 'wcag242'],
      description: 'Document has title',
      help: 'Document must have title',
      helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/document-title',
      nodes: [],
    },
  ],
  incomplete: [],
  inapplicable: [],
};

const TEST_OUT_DIR = join(process.cwd(), 'test-cli-m6-export');

describe('CLI workflow integration tests', () => {
  let stdoutLogs: string[];
  let stderrLogs: string[];
  let testIo: CliIo;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    stdoutLogs = [];
    stderrLogs = [];
    testIo = {
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    };

    vi.mocked(scanAccessibility).mockResolvedValue({
      requestedUrl: 'https://example.com',
      finalUrl: 'https://example.com/',
      title: 'Example Domain',
      scannedAt: '2026-09-08T12:00:00.000Z',
      durationMs: 350,
      axe: MOCK_AXE_RESULTS as never,
    });
  });

  afterEach(async () => {
    await rm(TEST_OUT_DIR, { recursive: true, force: true });
  });

  it('scans URL, computes score via real core, formats terminal summary, and exits SUCCESS', async () => {
    const program = createProgram({ io: testIo, exitOverride: true });
    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
    ]);

    const output = stdoutLogs.join('\n');
    expect(output).toContain('A11yFix Accessibility Audit Report');
    expect(output).toContain('URL:         https://example.com');
    // critical (10 * 1) + serious (5 * 1) = 15 penalty -> Score: 85 (Grade B)
    expect(output).toContain('Score:       85/100 (Grade B)');
    expect(output).toContain('image-alt');
    expect(output).toContain('color-contrast');
    expect(process.exitCode ?? EXIT_CODES.SUCCESS).toBe(EXIT_CODES.SUCCESS);
  });

  it('exports real HTML report to filesystem and verifies content', async () => {
    const outputPath = join(TEST_OUT_DIR, 'nested', 'audit.html');
    const program = createProgram({ io: testIo, exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '-o',
      outputPath,
    ]);

    expect(process.exitCode ?? EXIT_CODES.SUCCESS).toBe(EXIT_CODES.SUCCESS);

    const writtenHtml = await readFile(outputPath, 'utf8');
    expect(writtenHtml).toContain('<!DOCTYPE html>');
    expect(writtenHtml).toContain('Example Domain');
    expect(writtenHtml).toContain('image-alt');
    expect(writtenHtml).toContain('color-contrast');
    expect(writtenHtml).toContain('Grade B');
  });

  it('exports real JSON report to filesystem and verifies schema', async () => {
    const outputPath = join(TEST_OUT_DIR, 'audit.json');
    const program = createProgram({ io: testIo, exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '-o',
      outputPath,
      '-f',
      'json',
    ]);

    expect(process.exitCode ?? EXIT_CODES.SUCCESS).toBe(EXIT_CODES.SUCCESS);

    const writtenJson = JSON.parse(
      await readFile(outputPath, 'utf8'),
    ) as AccessibilityReport;
    expect(writtenJson.score).toBe(85);
    expect(writtenJson.grade).toBe('B');
    expect(writtenJson.findings).toHaveLength(2);
    expect(writtenJson.findings[0]?.ruleId).toBe('image-alt');
    expect(writtenJson.meta.title).toBe('Example Domain');
  });

  it('outputs parseable JSON to stdout with --json flag and suppresses summary', async () => {
    const program = createProgram({ io: testIo, exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '--json',
    ]);

    expect(process.exitCode ?? EXIT_CODES.SUCCESS).toBe(EXIT_CODES.SUCCESS);
    expect(stdoutLogs).toHaveLength(1);

    const parsedStdout = JSON.parse(stdoutLogs[0]!) as AccessibilityReport;
    expect(parsedStdout.score).toBe(85);
    expect(parsedStdout.grade).toBe('B');
    expect(stdoutLogs[0]).not.toContain('A11yFix Accessibility Audit Report');
  });

  it('fails with exit code 1 when score is below threshold gate', async () => {
    const program = createProgram({ io: testIo, exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '--threshold',
      '90',
    ]);

    expect(process.exitCode).toBe(EXIT_CODES.FAILURE);
    const output = stdoutLogs.join('\n');
    expect(output).toContain('✖ FAIL: Score 85 is below threshold 90');
  });

  it('passes with exit code 0 when score meets threshold gate', async () => {
    const program = createProgram({ io: testIo, exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '--threshold',
      '80',
    ]);

    expect(process.exitCode ?? EXIT_CODES.SUCCESS).toBe(EXIT_CODES.SUCCESS);
    const output = stdoutLogs.join('\n');
    expect(output).toContain('✔ PASS: Score 85 meets threshold 80');
  });

  it('suppresses stdout completely with --quiet while still exporting report', async () => {
    const outputPath = join(TEST_OUT_DIR, 'quiet-report.html');
    const program = createProgram({ io: testIo, exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '--quiet',
      '-o',
      outputPath,
    ]);

    expect(process.exitCode ?? EXIT_CODES.SUCCESS).toBe(EXIT_CODES.SUCCESS);
    expect(stdoutLogs).toHaveLength(0);

    const writtenHtml = await readFile(outputPath, 'utf8');
    expect(writtenHtml).toContain('<!DOCTYPE html>');
  });

  it('rejects invalid threshold option with Commander error', async () => {
    const program = createProgram({ io: testIo, exitOverride: true });

    await expect(
      program.parseAsync([
        'node',
        'a11yfix',
        'scan',
        'https://example.com',
        '--threshold',
        '150',
      ]),
    ).rejects.toThrow();
  });

  it('rejects invalid timeout option with Commander error', async () => {
    const program = createProgram({ io: testIo, exitOverride: true });

    await expect(
      program.parseAsync([
        'node',
        'a11yfix',
        'scan',
        'https://example.com',
        '--timeout',
        '-100',
      ]),
    ).rejects.toThrow();
  });
});
