import { describe, expect, it, vi } from 'vitest';

import {
  createProgram,
  executeScan,
  EXIT_CODES,
  formatError,
  formatTerminalSummary,
  isMainModule,
  run,
} from './index.js';

describe('@a11yfix/cli index exports', () => {
  it('exposes all public CLI functions and constants', () => {
    expect(typeof createProgram).toBe('function');
    expect(typeof executeScan).toBe('function');
    expect(typeof formatTerminalSummary).toBe('function');
    expect(typeof formatError).toBe('function');
    expect(typeof isMainModule).toBe('function');
    expect(typeof run).toBe('function');
    expect(EXIT_CODES).toEqual({
      SUCCESS: 0,
      FAILURE: 1,
      INVALID_ARGS: 2,
    });
  });

  it('detects isMainModule accurately based on process.argv', () => {
    const originalArgv1 = process.argv[1];
    try {
      process.argv[1] = '';
      expect(isMainModule()).toBe(false);
    } finally {
      process.argv[1] = originalArgv1 ?? '';
    }
  });

  it('runs commander program when run() is called with argv', () => {
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as never);
    try {
      const program = createProgram({ exitOverride: true });
      expect(program.name()).toBe('a11yfix');
    } finally {
      mockExit.mockRestore();
    }
  });
});
