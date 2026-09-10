import type { AccessibilityReport } from '@a11yfix/core';

export interface ScanApiRequest {
  readonly url: string;
  readonly timeout?: number | undefined;
}

export interface CrawlApiRequest {
  readonly url: string;
  readonly maxPages?: number | undefined;
  readonly maxDepth?: number | undefined;
  readonly timeout?: number | undefined;
}

export interface ExportApiRequest {
  readonly report:
    AccessibilityReport | import('@a11yfix/core').MultiPageReport;
  readonly format: 'html' | 'json' | 'sarif';
}

export interface DiffApiRequest {
  readonly baseline:
    AccessibilityReport | import('@a11yfix/core').MultiPageReport;
  readonly current:
    AccessibilityReport | import('@a11yfix/core').MultiPageReport;
}

export interface RemediateApiRequest {
  readonly report?: AccessibilityReport | undefined;
  readonly finding?: import('@a11yfix/core').Finding | undefined;
  readonly nodeIndex?: number | undefined;
  readonly framework?: import('@a11yfix/core').RemediationFramework | undefined;
  readonly provider?:
    'heuristic' | 'openai' | 'anthropic' | 'custom' | undefined;
  readonly apiKey?: string | undefined;
  readonly endpoint?: string | undefined;
  readonly model?: string | undefined;
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
