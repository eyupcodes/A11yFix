import { generateUnifiedDiff } from './remediation-diff.js';
import { generateHeuristicFix } from './remediation-heuristics.js';
import type {
  Finding,
  FindingNode,
  RemediationConfidence,
  RemediationFramework,
  RemediationOptions,
  RemediationPatch,
} from './types.js';

export interface RemediationProvider {
  readonly name: string;
  generateFix(
    finding: Finding,
    node: FindingNode,
    options: RemediationOptions,
  ): Promise<RemediationPatch>;
}

export class HeuristicRemediationProvider implements RemediationProvider {
  readonly name = 'heuristic';

  generateFix(
    finding: Finding,
    node: FindingNode,
    options: RemediationOptions,
  ): Promise<RemediationPatch> {
    const patch = generateHeuristicFix(
      finding,
      node,
      options.framework ?? 'html',
    );
    return Promise.resolve(patch);
  }
}

interface LlmResponsePayload {
  readonly fixedCode?: string;
  readonly explanation?: string;
  readonly changes?: readonly string[];
  readonly confidence?: RemediationConfidence;
}

function buildPrompt(
  finding: Finding,
  node: FindingNode,
  framework: RemediationFramework,
): { readonly system: string; readonly user: string } {
  const system = `You are an expert web accessibility engineer.
You are given an accessibility violation detected by axe-core.
Generate an accessible code fix in target framework: ${framework}.
Output ONLY a raw JSON object with keys:
{
  "fixedCode": "<accessible snippet in ${framework}>",
  "explanation": "<one or two sentences explaining the fix>",
  "changes": ["<bullet 1>", "<bullet 2>"],
  "confidence": "high" | "medium" | "low"
}`;

  const user = `Rule: ${finding.ruleId} (${finding.severity})
WCAG Criteria: ${finding.wcag.criteria.join(', ')} (${finding.wcag.level})
Description: ${finding.description}
Failure Summary: ${node.failureSummary ?? finding.remediation.summary}
CSS Target: ${node.target.join(' ')}
Original HTML:
${node.html}`;

  return { system, user };
}

function parseLlmJson(raw: string): LlmResponsePayload | null {
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as LlmResponsePayload;
  } catch {
    return null;
  }
}

export class OpenAiRemediationProvider implements RemediationProvider {
  readonly name = 'openai';

  async generateFix(
    finding: Finding,
    node: FindingNode,
    options: RemediationOptions,
  ): Promise<RemediationPatch> {
    const framework = options.framework ?? 'html';
    const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];

    if (!apiKey) {
      return generateHeuristicFix(finding, node, framework);
    }

    const { system, user } = buildPrompt(finding, node, framework);
    const endpoint =
      options.endpoint ?? 'https://api.openai.com/v1/chat/completions';
    const model = options.model ?? 'gpt-4o-mini';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        return generateHeuristicFix(finding, node, framework);
      }

      const data = (await res.json()) as {
        readonly choices?: readonly [
          { readonly message?: { readonly content?: string } },
        ];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      const parsed = parseLlmJson(content);

      if (!parsed?.fixedCode) {
        return generateHeuristicFix(finding, node, framework);
      }

      const fixedCode = parsed.fixedCode;
      const diff = generateUnifiedDiff(node.html, fixedCode);

      return {
        ruleId: finding.ruleId,
        target: node.target,
        originalHtml: node.html,
        fixedCode,
        explanation: parsed.explanation ?? finding.help,
        framework,
        confidence: parsed.confidence ?? 'high',
        changes: parsed.changes ?? ['AI-generated accessibility remediation'],
        diff,
      };
    } catch {
      return generateHeuristicFix(finding, node, framework);
    }
  }
}

export class AnthropicRemediationProvider implements RemediationProvider {
  readonly name = 'anthropic';

  async generateFix(
    finding: Finding,
    node: FindingNode,
    options: RemediationOptions,
  ): Promise<RemediationPatch> {
    const framework = options.framework ?? 'html';
    const apiKey = options.apiKey ?? process.env['ANTHROPIC_API_KEY'];

    if (!apiKey) {
      return generateHeuristicFix(finding, node, framework);
    }

    const { system, user } = buildPrompt(finding, node, framework);
    const endpoint =
      options.endpoint ?? 'https://api.anthropic.com/v1/messages';
    const model = options.model ?? 'claude-3-5-haiku-20241022';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system,
          messages: [{ role: 'user', content: user }],
          max_tokens: 1024,
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        return generateHeuristicFix(finding, node, framework);
      }

      const data = (await res.json()) as {
        readonly content?: readonly [{ readonly text?: string }];
      };
      const content = data.content?.[0]?.text ?? '';
      const parsed = parseLlmJson(content);

      if (!parsed?.fixedCode) {
        return generateHeuristicFix(finding, node, framework);
      }

      const fixedCode = parsed.fixedCode;
      const diff = generateUnifiedDiff(node.html, fixedCode);

      return {
        ruleId: finding.ruleId,
        target: node.target,
        originalHtml: node.html,
        fixedCode,
        explanation: parsed.explanation ?? finding.help,
        framework,
        confidence: parsed.confidence ?? 'high',
        changes: parsed.changes ?? ['AI-generated accessibility remediation'],
        diff,
      };
    } catch {
      return generateHeuristicFix(finding, node, framework);
    }
  }
}

export class CustomRemediationProvider implements RemediationProvider {
  readonly name = 'custom';

  async generateFix(
    finding: Finding,
    node: FindingNode,
    options: RemediationOptions,
  ): Promise<RemediationPatch> {
    const framework = options.framework ?? 'html';
    const endpoint =
      options.endpoint ?? 'http://localhost:11434/v1/chat/completions';

    const { system, user } = buildPrompt(finding, node, framework);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (options.apiKey) {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: options.model ?? 'llama3',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        return generateHeuristicFix(finding, node, framework);
      }

      const data = (await res.json()) as {
        readonly choices?: readonly [
          { readonly message?: { readonly content?: string } },
        ];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      const parsed = parseLlmJson(content);

      if (!parsed?.fixedCode) {
        return generateHeuristicFix(finding, node, framework);
      }

      const fixedCode = parsed.fixedCode;
      const diff = generateUnifiedDiff(node.html, fixedCode);

      return {
        ruleId: finding.ruleId,
        target: node.target,
        originalHtml: node.html,
        fixedCode,
        explanation: parsed.explanation ?? finding.help,
        framework,
        confidence: parsed.confidence ?? 'medium',
        changes: parsed.changes ?? [
          'Custom endpoint accessibility remediation',
        ],
        diff,
      };
    } catch {
      return generateHeuristicFix(finding, node, framework);
    }
  }
}

/**
 * Factory resolving the appropriate remediation provider.
 */
export function getRemediationProvider(
  options?: RemediationOptions,
): RemediationProvider {
  const provider = options?.provider;

  if (provider === 'openai') {
    return new OpenAiRemediationProvider();
  }
  if (provider === 'anthropic') {
    return new AnthropicRemediationProvider();
  }
  if (provider === 'custom') {
    return new CustomRemediationProvider();
  }
  return new HeuristicRemediationProvider();
}
