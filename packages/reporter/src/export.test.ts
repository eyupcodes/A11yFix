import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { AccessibilityReport } from '@a11yfix/core';
import { afterEach, describe, expect, it } from 'vitest';

import { writeReport } from './export.js';
import type { SarifLog } from './sarif.js';

const MOCK_REPORT: AccessibilityReport = {
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
    passes: 10,
    incomplete: 0,
    inapplicable: 5,
  },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com/',
    title: 'Example',
    scannedAt: '2026-09-08T00:00:00.000Z',
  },
};

const TEST_DIR = join(process.cwd(), 'test-output-m4');

describe('writeReport', () => {
  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it('auto-detects json extension and writes file', async () => {
    const filePath = join(TEST_DIR, 'nested', 'report.json');
    await writeReport(MOCK_REPORT, filePath);

    const content = await readFile(filePath, 'utf8');
    expect(JSON.parse(content)).toEqual(MOCK_REPORT);
  });

  it('auto-detects html extension and writes file', async () => {
    const filePath = join(TEST_DIR, 'report.html');
    await writeReport(MOCK_REPORT, filePath, { title: 'Exported Report' });

    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('Exported Report');
  });

  it('auto-detects htm extension and writes file', async () => {
    const filePath = join(TEST_DIR, 'report.htm');
    await writeReport(MOCK_REPORT, filePath);

    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('auto-detects sarif extension and writes file', async () => {
    const filePath = join(TEST_DIR, 'report.sarif');
    await writeReport(MOCK_REPORT, filePath);

    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as SarifLog;
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs[0]!.tool.driver.name).toBe('A11yFix');
  });

  it('allows format option to override file extension', async () => {
    const filePath = join(TEST_DIR, 'output.custom');
    await writeReport(MOCK_REPORT, filePath, { format: 'json', pretty: true });

    const content = await readFile(filePath, 'utf8');
    expect(content).toContain('\n  "score": 100');
    expect(JSON.parse(content)).toEqual(MOCK_REPORT);
  });

  it('allows sarif format option to override file extension', async () => {
    const filePath = join(TEST_DIR, 'output.custom');
    await writeReport(MOCK_REPORT, filePath, { format: 'sarif' });

    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as SarifLog;
    expect(parsed.version).toBe('2.1.0');
  });

  it('rejects unsupported extensions when format is omitted', async () => {
    const filePath = join(TEST_DIR, 'report.xml');
    await expect(writeReport(MOCK_REPORT, filePath)).rejects.toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' }),
    );
  });

  it('rejects unsupported explicit formats', async () => {
    const filePath = join(TEST_DIR, 'report.json');
    await expect(
      writeReport(MOCK_REPORT, filePath, { format: 'xml' as never }),
    ).rejects.toThrow(expect.objectContaining({ code: 'UNSUPPORTED_FORMAT' }));
  });

  it('wraps filesystem errors in FILE_WRITE_FAILED', async () => {
    // Attempting to write into a path where directory creation fails or invalid target
    const invalidPath = join(TEST_DIR, 'sub');
    await writeReport(MOCK_REPORT, invalidPath, { format: 'json' });

    // Trying to write a file inside a file path (which is not a directory) triggers ENOTDIR
    await expect(
      writeReport(MOCK_REPORT, join(invalidPath, 'nested-fail', 'report.json')),
    ).rejects.toThrow(expect.objectContaining({ code: 'FILE_WRITE_FAILED' }));
  });
});
