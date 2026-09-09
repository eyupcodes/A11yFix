import type { AccessibilityReport } from '@a11yfix/core';

export interface ScanApiRequest {
  readonly url: string;
  readonly timeout?: number | undefined;
}

export interface ExportApiRequest {
  readonly report: AccessibilityReport;
  readonly format: 'html' | 'json';
}

export interface HealthApiResponse {
  readonly status: 'ok';
  readonly version: string;
  readonly timestamp: string;
}

export interface ApiErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly details?: unknown;
}
