/**
 * Public types for `@a11yfix/reporter`.
 *
 * Defines formatting options, supported export formats, and file-writing
 * parameters for accessibility report rendering.
 */

/** Supported export report formats. */
export type ReportFormat = 'json' | 'html' | 'sarif';

/** Options for JSON report serialization. */
export interface JsonReportOptions {
  /** When true, formats the JSON with 2-space indentation. Defaults to false. */
  readonly pretty?: boolean;
}

/** Options for SARIF report serialization. */
export interface SarifReportOptions {
  /** When true, formats the SARIF JSON with 2-space indentation. Defaults to false. */
  readonly pretty?: boolean;
}

/** Options for HTML report rendering. */
export interface HtmlReportOptions {
  /** Optional custom document title for the HTML page. Defaults to scan title or URL. */
  readonly title?: string;
}

/** Options for file export writing. */
export interface WriteReportOptions {
  /** Explicit output format. If omitted, auto-detected from file extension. */
  readonly format?: ReportFormat;
  /** When outputting JSON, format with indentation. */
  readonly pretty?: boolean;
  /** When outputting HTML, custom title for the report. */
  readonly title?: string;
}
