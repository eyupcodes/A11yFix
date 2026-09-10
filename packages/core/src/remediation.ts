import { getRemediationProvider } from './remediation-providers.js';
import type {
  AccessibilityReport,
  Finding,
  FindingNode,
  RemediationOptions,
  RemediationPatch,
  ReportRemediationPlan,
  RuleRemediationResult,
} from './types.js';

/**
 * Generates an accessibility remediation code patch for a single finding node.
 *
 * @param finding - The accessibility finding containing violation context.
 * @param nodeIndex - The index of the node within the finding (defaults to 0).
 * @param options - Remediation configuration (framework, provider, credentials).
 * @returns Generated code patch with unified diff and explanation.
 */
export async function generateRemediationPatch(
  finding: Finding,
  nodeIndex = 0,
  options?: RemediationOptions,
): Promise<RemediationPatch> {
  const provider = getRemediationProvider(options);
  const node: FindingNode = finding.nodes[nodeIndex] ?? {
    html: '',
    target: ['html'],
    failureSummary: finding.remediation.summary,
  };

  return provider.generateFix(finding, node, options ?? {});
}

/**
 * Generates a comprehensive remediation plan across all findings in an AccessibilityReport.
 *
 * @param report - The analyzed accessibility report.
 * @param options - Remediation options (framework, provider, credentials).
 * @returns Structured remediation plan containing code patches and unified diffs.
 */
export async function generateReportRemediationPlan(
  report: AccessibilityReport,
  options?: RemediationOptions,
): Promise<ReportRemediationPlan> {
  const provider = getRemediationProvider(options);
  const framework = options?.framework ?? 'html';
  const results: RuleRemediationResult[] = [];
  let remediatedCount = 0;

  for (const finding of report.findings) {
    const patches: RemediationPatch[] = [];
    // Remediate each node up to a reasonable cap of 10 nodes per rule
    const targetNodes = finding.nodes.slice(0, 10);

    for (const node of targetNodes) {
      const patch = await provider.generateFix(finding, node, options ?? {});
      patches.push(patch);
      remediatedCount++;
    }

    if (patches.length > 0) {
      results.push({
        ruleId: finding.ruleId,
        description: finding.description,
        helpUrl: finding.remediation.helpUrl,
        patches,
      });
    }
  }

  const totalViolations = report.findings.reduce(
    (acc, f) => acc + f.nodeCount,
    0,
  );

  return {
    totalViolations,
    remediatedCount,
    framework,
    provider: provider.name,
    results,
    generatedAt: new Date().toISOString(),
  };
}
