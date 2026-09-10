/**
 * OASIS SARIF v2.1.0 report generator for `@a11yfix/reporter`.
 *
 * Produces standard SARIF (Static Analysis Results Interchange Format) JSON
 * for integration with GitHub Code Scanning, GitLab Security, and Azure DevOps.
 */

import type {
  AccessibilityReport,
  Finding,
  MultiPageReport,
  Severity,
} from '@a11yfix/core';

import type { SarifReportOptions } from './types.js';
import { validateMultiPageReport, validateReport } from './validate.js';

export interface SarifPhysicalLocation {
  readonly artifactLocation: {
    readonly uri: string;
  };
  readonly region?: {
    readonly snippet?: {
      readonly text: string;
    };
  };
}

export interface SarifLogicalLocation {
  readonly fullyQualifiedName: string;
  readonly kind?: string;
}

export interface SarifLocation {
  readonly physicalLocation?: SarifPhysicalLocation;
  readonly logicalLocations?: readonly SarifLogicalLocation[];
}

export interface SarifReportingDescriptor {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: {
    readonly text: string;
  };
  readonly fullDescription: {
    readonly text: string;
  };
  readonly helpUri?: string;
  readonly help?: {
    readonly text: string;
    readonly markdown?: string;
  };
  readonly defaultConfiguration: {
    readonly level: 'error' | 'warning' | 'note';
  };
  readonly properties: {
    readonly tags: readonly string[];
    readonly precision: 'high';
    readonly 'problem.severity': 'error' | 'warning';
  };
}

export interface SarifResult {
  readonly ruleId: string;
  readonly ruleIndex: number;
  readonly level: 'error' | 'warning' | 'note';
  readonly message: {
    readonly text: string;
  };
  readonly locations?: readonly SarifLocation[];
}

export interface SarifRun {
  readonly tool: {
    readonly driver: {
      readonly name: string;
      readonly version: string;
      readonly informationUri: string;
      readonly rules: readonly SarifReportingDescriptor[];
    };
  };
  readonly results: readonly SarifResult[];
}

export interface SarifLog {
  readonly $schema: string;
  readonly version: '2.1.0';
  readonly runs: readonly SarifRun[];
}

const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';
const TOOL_NAME = 'A11yFix';
const TOOL_VERSION = '0.1.0';
const TOOL_URI = 'https://github.com/eyupcodes/A11yFix';

/**
 * Maps A11yFix severity to OASIS SARIF level.
 * Critical and serious violations map to 'error', moderate to 'warning', minor to 'note'.
 */
function severityToSarifLevel(
  severity: Severity,
): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'critical':
    case 'serious':
      return 'error';
    case 'moderate':
      return 'warning';
    case 'minor':
      return 'note';
  }
}

/**
 * Builds tags for a finding's reporting descriptor.
 */
function buildTags(finding: Finding): readonly string[] {
  const tags: string[] = ['accessibility'];

  if (finding.wcag.level) {
    tags.push(`wcag2${finding.wcag.level.toLowerCase()}`);
  }

  for (const criterion of finding.wcag.criteria) {
    const compact = criterion.replace(/\./g, '');
    tags.push(`wcag${compact}`);
  }

  if (finding.wcag.isBestPractice) {
    tags.push('best-practice');
  }

  return tags;
}

/**
 * Builds a markdown remediation string for a rule.
 */
function buildHelpMarkdown(finding: Finding): string {
  const sections: string[] = [
    `### ${finding.help}`,
    '',
    finding.description,
    '',
    `**Severity:** ${finding.severity}`,
  ];

  if (finding.wcag.criteria.length > 0) {
    sections.push(
      `**WCAG Criteria:** ${finding.wcag.criteria.join(', ')} (Level ${finding.wcag.level ?? 'N/A'})`,
    );
  }

  if (finding.remediation.details) {
    sections.push('', `**Guidance:** ${finding.remediation.details}`);
  }

  if (finding.remediation.helpUrl) {
    sections.push(
      '',
      `[More information on Deque University](${finding.remediation.helpUrl})`,
    );
  }

  return sections.join('\n');
}

/**
 * Creates a SARIF reporting descriptor from a finding.
 */
function createReportingDescriptor(finding: Finding): SarifReportingDescriptor {
  const level = severityToSarifLevel(finding.severity);
  const problemSeverity = level === 'error' ? 'error' : 'warning';

  return {
    id: finding.ruleId,
    name: finding.ruleId,
    shortDescription: {
      text: finding.help,
    },
    fullDescription: {
      text: finding.description,
    },
    ...(finding.remediation.helpUrl
      ? { helpUri: finding.remediation.helpUrl }
      : {}),
    help: {
      text: `${finding.remediation.summary}${
        finding.remediation.details ? `\n\n${finding.remediation.details}` : ''
      }`,
      markdown: buildHelpMarkdown(finding),
    },
    defaultConfiguration: {
      level,
    },
    properties: {
      tags: buildTags(finding),
      precision: 'high',
      'problem.severity': problemSeverity,
    },
  };
}

interface FindingOccurrence {
  readonly finding: Finding;
  readonly pageUrl: string;
}

function isMultiPageReport(
  report: AccessibilityReport | MultiPageReport,
): report is MultiPageReport {
  return (
    typeof report === 'object' &&
    report !== null &&
    'summary' in report &&
    'pages' in report &&
    'commonViolations' in report
  );
}

/**
 * Collects all finding occurrences from an AccessibilityReport or MultiPageReport.
 */
function collectOccurrences(
  report: AccessibilityReport | MultiPageReport,
): readonly FindingOccurrence[] {
  if (isMultiPageReport(report)) {
    validateMultiPageReport(report);
    const occurrences: FindingOccurrence[] = [];
    for (const page of report.pages) {
      if (page.report) {
        for (const finding of page.report.findings) {
          occurrences.push({ finding, pageUrl: page.url });
        }
      }
    }
    return occurrences;
  }

  validateReport(report);
  const pageUrl =
    report.meta.finalUrl ?? report.meta.requestedUrl ?? 'http://localhost/';

  return report.findings.map((finding) => ({
    finding,
    pageUrl,
  }));
}

/**
 * Builds the SARIF v2.1.0 log structure from an accessibility report.
 */
export function buildSarifLog(
  report: AccessibilityReport | MultiPageReport,
): SarifLog {
  const occurrences = collectOccurrences(report);

  // Collect and deduplicate rules in insertion order
  const rulesMap = new Map<string, SarifReportingDescriptor>();
  for (const { finding } of occurrences) {
    if (!rulesMap.has(finding.ruleId)) {
      rulesMap.set(finding.ruleId, createReportingDescriptor(finding));
    }
  }

  const rules = Array.from(rulesMap.values());
  const ruleIndexMap = new Map<string, number>(
    rules.map((rule, idx) => [rule.id, idx]),
  );

  const results: SarifResult[] = [];

  for (const { finding, pageUrl } of occurrences) {
    const ruleIndex = ruleIndexMap.get(finding.ruleId) ?? 0;
    const level = severityToSarifLevel(finding.severity);

    if (finding.nodes.length === 0) {
      results.push({
        ruleId: finding.ruleId,
        ruleIndex,
        level,
        message: {
          text: finding.help || finding.description,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: pageUrl,
              },
            },
          },
        ],
      });
      continue;
    }

    for (const node of finding.nodes) {
      const messageText =
        node.failureSummary ?? finding.help ?? finding.description;

      const physicalLocation: SarifPhysicalLocation = {
        artifactLocation: {
          uri: pageUrl,
        },
        ...(node.html
          ? {
              region: {
                snippet: {
                  text: node.html,
                },
              },
            }
          : {}),
      };

      const logicalLocations: readonly SarifLogicalLocation[] | undefined =
        node.target && node.target.length > 0
          ? [
              {
                fullyQualifiedName: node.target.join(' '),
                kind: 'element',
              },
            ]
          : undefined;

      results.push({
        ruleId: finding.ruleId,
        ruleIndex,
        level,
        message: {
          text: messageText,
        },
        locations: [
          {
            physicalLocation,
            ...(logicalLocations ? { logicalLocations } : {}),
          },
        ],
      });
    }
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: TOOL_URI,
            rules,
          },
        },
        results,
      },
    ],
  };
}

/**
 * Serializes an AccessibilityReport or MultiPageReport to an OASIS SARIF v2.1.0 JSON string.
 *
 * @param report The validated report to render.
 * @param options SARIF serialization options (e.g. pretty indentation).
 * @returns Standard SARIF v2.1.0 JSON string.
 */
export function renderSarifReport(
  report: AccessibilityReport | MultiPageReport,
  options?: SarifReportOptions,
): string {
  const sarifLog = buildSarifLog(report);
  return options?.pretty
    ? JSON.stringify(sarifLog, null, 2)
    : JSON.stringify(sarifLog);
}
