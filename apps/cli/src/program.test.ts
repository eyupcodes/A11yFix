import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createProgram } from './program.js';
import { executeScan } from './scan.js';
import { EXIT_CODES } from './types.js';

vi.mock('./scan.js', () => ({
  executeScan: vi.fn(),
}));

describe('createProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = undefined;
    vi.mocked(executeScan).mockResolvedValue(EXIT_CODES.SUCCESS);
  });

  it('defines the CLI name, description, and version', () => {
    const program = createProgram({ exitOverride: true });

    expect(program.name()).toBe('a11yfix');
    expect(program.description()).toBe(
      'Automated web accessibility scanner for developers.',
    );
    expect(program.version()).toBe('0.0.0');
  });

  it('parses options and invokes executeScan', async () => {
    const program = createProgram({ exitOverride: true });

    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
      '--output',
      'report.html',
      '--format',
      'html',
      '--threshold',
      '80',
      '--timeout',
      '15000',
      '--json',
      '--quiet',
    ]);

    expect(executeScan).toHaveBeenCalledWith(
      'https://example.com',
      {
        output: 'report.html',
        format: 'html',
        threshold: 80,
        timeout: 15000,
        json: true,
        quiet: true,
      },
      undefined,
    );
  });

  it('sets process.exitCode when executeScan returns non-zero code', async () => {
    vi.mocked(executeScan).mockResolvedValue(EXIT_CODES.FAILURE);

    const program = createProgram({ exitOverride: true });
    await program.parseAsync([
      'node',
      'a11yfix',
      'scan',
      'https://example.com',
    ]);

    expect(process.exitCode).toBe(EXIT_CODES.FAILURE);
  });

  it('rejects invalid threshold option', async () => {
    const program = createProgram({ exitOverride: true });

    await expect(
      program.parseAsync([
        'node',
        'a11yfix',
        'scan',
        'https://example.com',
        '--threshold',
        'not-a-number',
      ]),
    ).rejects.toThrow();
  });

  it('rejects invalid timeout option', async () => {
    const program = createProgram({ exitOverride: true });

    await expect(
      program.parseAsync([
        'node',
        'a11yfix',
        'scan',
        'https://example.com',
        '--timeout',
        '-50',
      ]),
    ).rejects.toThrow();
  });
});
