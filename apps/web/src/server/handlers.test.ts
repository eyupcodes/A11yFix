import type { AccessibilityReport } from '@a11yfix/core';
import { analyzeAxeResults } from '@a11yfix/core';
import {
  renderHtmlReport,
  renderJsonReport,
  ReporterError,
} from '@a11yfix/reporter';
import { scanAccessibility, ScannerError } from '@a11yfix/scanner';
import { describe, expect, it, vi } from 'vitest';

import { handleExport, handleHealth, handleScan } from './handlers.js';

vi.mock('@a11yfix/scanner', () => ({
  scanAccessibility: vi.fn(),
  ScannerError: class ScannerError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('@a11yfix/core', () => ({
  analyzeAxeResults: vi.fn(),
}));

vi.mock('@a11yfix/reporter', () => ({
  renderHtmlReport: vi.fn(),
  renderJsonReport: vi.fn(),
  ReporterError: class ReporterError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

const mockReport = {
  score: 95,
  grade: 'A',
  findings: [],
  breakdown: {
    countsBySeverity: { critical: 0, serious: 0, moderate: 0, minor: 0 },
    bestPracticeFindings: 0,
  },
  ruleCounts: { violations: 0, passes: 10, incomplete: 0, inapplicable: 0 },
  meta: {
    requestedUrl: 'https://example.com',
    finalUrl: 'https://example.com',
    title: 'Example',
    scannedAt: '2026-09-09T00:00:00.000Z',
    durationMs: 150,
  },
} as unknown as AccessibilityReport;

describe('API Handlers', () => {
  describe('handleHealth', () => {
    it('returns status 200 with health metadata', () => {
      const response = handleHealth();
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.version).toBe('0.1.0');
      expect(typeof response.body.timestamp).toBe('string');
    });
  });

  describe('handleScan', () => {
    it('rejects invalid or missing URL with 400', async () => {
      const res1 = await handleScan(null);
      expect(res1.status).toBe(400);

      const res2 = await handleScan({});
      expect(res2.status).toBe(400);

      const res3 = await handleScan({ url: '   ' });
      expect(res3.status).toBe(400);
    });

    it('successfully scans a valid URL and returns the report', async () => {
      const mockScanResult = {
        axe: { violations: [] },
        requestedUrl: 'https://example.com',
        finalUrl: 'https://example.com',
        title: 'Example',
        scannedAt: new Date().toISOString(),
        durationMs: 200,
      };

      vi.mocked(scanAccessibility).mockResolvedValue(mockScanResult as never);
      vi.mocked(analyzeAxeResults).mockReturnValue(mockReport);

      const res = await handleScan({
        url: 'https://example.com',
        timeout: 15000,
      });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockReport);
      expect(scanAccessibility).toHaveBeenCalledWith('https://example.com', {
        navigationTimeoutMs: 15000,
      });
    });

    it('maps ScannerError INVALID_URL to 400', async () => {
      vi.mocked(scanAccessibility).mockRejectedValue(
        new ScannerError('INVALID_URL', 'Invalid URL format.'),
      );

      const res = await handleScan({ url: 'not-a-url' });
      expect(res.status).toBe(400);
      expect((res.body as { code: string }).code).toBe('INVALID_URL');
    });

    it('maps ScannerError NAVIGATION_FAILED to 502', async () => {
      vi.mocked(scanAccessibility).mockRejectedValue(
        new ScannerError('NAVIGATION_FAILED', 'Navigation timed out.'),
      );

      const res = await handleScan({ url: 'https://unreachable.site' });
      expect(res.status).toBe(502);
      expect((res.body as { code: string }).code).toBe('NAVIGATION_FAILED');
    });

    it('maps generic errors to 500', async () => {
      vi.mocked(scanAccessibility).mockRejectedValue(new Error('Crash'));

      const res = await handleScan({ url: 'https://example.com' });
      expect(res.status).toBe(500);
      expect((res.body as { code: string }).code).toBe('INTERNAL_ERROR');
    });
  });

  describe('handleExport', () => {
    it('rejects missing report or format with 400', () => {
      const res1 = handleExport(null);
      expect(res1.status).toBe(400);

      const res2 = handleExport({ report: mockReport });
      expect(res2.status).toBe(400);
    });

    it('rejects unsupported format with 400', () => {
      const res = handleExport({ report: mockReport, format: 'pdf' });
      expect(res.status).toBe(400);
    });

    it('exports HTML report with text/html content type', () => {
      vi.mocked(renderHtmlReport).mockReturnValue(
        '<!DOCTYPE html><html></html>',
      );

      const res = handleExport({ report: mockReport, format: 'html' });
      expect(res.status).toBe(200);
      expect(res.contentType).toBe('text/html; charset=utf-8');
      expect(res.body).toBe('<!DOCTYPE html><html></html>');
    });

    it('exports JSON report with application/json content type', () => {
      vi.mocked(renderJsonReport).mockReturnValue('{"score":95}');

      const res = handleExport({ report: mockReport, format: 'json' });
      expect(res.status).toBe(200);
      expect(res.contentType).toBe('application/json; charset=utf-8');
      expect(res.body).toBe('{"score":95}');
    });

    it('surfaces ReporterError as 400', () => {
      vi.mocked(renderHtmlReport).mockImplementation(() => {
        throw new ReporterError('INVALID_REPORT', 'Invalid report');
      });

      const res = handleExport({ report: mockReport, format: 'html' });
      expect(res.status).toBe(400);
      const errorBody = JSON.parse(res.body) as { code: string };
      expect(errorBody.code).toBe('INVALID_REPORT');
    });
  });
});
