import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AccessibilityReport, RemediationFramework } from '@a11yfix/core';
import {
  analyzeAxeResults,
  generateReportRemediationPlan,
} from '@a11yfix/core';
import {
  renderRemediationHtmlReport,
  renderRemediationJsonReport,
} from '@a11yfix/reporter';
import { scanAccessibility, ScannerError } from '@a11yfix/scanner';

import { formatError, formatRemediationTerminalSummary } from './formatters.js';
import type { CliIo, ExitCode, RemediateCommandOptions } from './types.js';
import { EXIT_CODES } from './types.js';

const DEFAULT_IO: CliIo = {
  stdout: (msg) => console.log(msg),
  stderr: (msg) => console.error(msg),
};

const VALID_FRAMEWORKS: ReadonlySet<string> = new Set([
  'html',
  'react',
  'vue',
  'svelte',
]);

const VALID_PROVIDERS: ReadonlySet<string> = new Set([
  'heuristic',
  'openai',
  'anthropic',
  'custom',
]);

function isUrl(target: string): boolean {
  return /^https?:\/\//i.test(target.trim());
}

/**
 * Executes the `a11yfix remediate` command.
 *
 * @param target - A live web URL or local report JSON file path.
 * @param options - CLI flags for framework, provider, output, and formatting.
 * @param io - Terminal I/O interface for testing dependency injection.
 * @returns Exit code indicating success, failure, or invalid arguments.
 */
export async function executeRemediate(
  target: string,
  options: RemediateCommandOptions = {},
  io: CliIo = DEFAULT_IO,
): Promise<ExitCode> {
  const framework: RemediationFramework = options.framework ?? 'html';
  if (!VALID_FRAMEWORKS.has(framework)) {
    io.stderr(
      formatError(
        new Error(
          `Invalid framework "${options.framework}". Valid options are: html, react, vue, svelte.`,
        ),
      ),
    );
    return EXIT_CODES.INVALID_ARGS;
  }

  if (options.provider && !VALID_PROVIDERS.has(options.provider)) {
    io.stderr(
      formatError(
        new Error(
          `Invalid provider "${options.provider}". Valid options are: heuristic, openai, anthropic, custom.`,
        ),
      ),
    );
    return EXIT_CODES.INVALID_ARGS;
  }

  if (
    options.format &&
    options.format !== 'json' &&
    options.format !== 'html'
  ) {
    io.stderr(
      formatError(
        new Error(
          `Invalid format "${String(options.format)}". Valid options are: json, html.`,
        ),
      ),
    );
    return EXIT_CODES.INVALID_ARGS;
  }

  let report: AccessibilityReport;

  try {
    if (isUrl(target)) {
      const scanResult = await scanAccessibility(target);
      report = analyzeAxeResults(scanResult.axe, scanResult);
    } else {
      let rawContent: string;
      try {
        rawContent = await readFile(target, 'utf-8');
      } catch {
        io.stderr(
          formatError(
            new Error(`Cannot read accessibility report file at: ${target}`),
          ),
        );
        return EXIT_CODES.INVALID_ARGS;
      }

      try {
        report = JSON.parse(rawContent) as AccessibilityReport;
      } catch {
        io.stderr(formatError(new Error(`File is not valid JSON: ${target}`)));
        return EXIT_CODES.INVALID_ARGS;
      }

      if (
        typeof report !== 'object' ||
        report === null ||
        !('findings' in report) ||
        !Array.isArray(report.findings)
      ) {
        io.stderr(
          formatError(
            new Error(
              `File does not match AccessibilityReport schema: ${target}`,
            ),
          ),
        );
        return EXIT_CODES.INVALID_ARGS;
      }
    }
  } catch (error) {
    if (error instanceof ScannerError && error.code === 'INVALID_URL') {
      io.stderr(formatError(error));
      return EXIT_CODES.INVALID_ARGS;
    }
    io.stderr(formatError(error));
    return EXIT_CODES.FAILURE;
  }

  try {
    const plan = await generateReportRemediationPlan(report, {
      framework,
      provider: options.provider,
      apiKey: options.apiKey,
      endpoint: options.endpoint,
      model: options.model,
    });

    if (options.output) {
      const format =
        options.format ??
        (options.output.toLowerCase().endsWith('.html') ? 'html' : 'json');

      const rendered =
        format === 'html'
          ? renderRemediationHtmlReport(plan)
          : renderRemediationJsonReport(plan, { pretty: true });

      const dir = dirname(options.output);
      if (dir && dir !== '.') {
        await mkdir(dir, { recursive: true });
      }
      await writeFile(options.output, rendered, 'utf-8');
    }

    if (options.json) {
      io.stdout(renderRemediationJsonReport(plan, { pretty: true }));
    } else if (!options.quiet) {
      io.stdout(
        formatRemediationTerminalSummary(
          plan,
          options.diff !== undefined ? { diff: options.diff } : undefined,
        ),
      );
    }

    return EXIT_CODES.SUCCESS;
  } catch (error) {
    io.stderr(formatError(error));
    return EXIT_CODES.FAILURE;
  }
}
