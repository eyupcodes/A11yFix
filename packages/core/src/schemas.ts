/**
 * Runtime validation for axe-core results.
 *
 * Axe output crosses a trust boundary — it is produced inside a page
 * whose content the scanner does not control, so a hostile or broken
 * page can hand back anything. These schemas validate only the fields
 * M3 actually reads and strip everything else, so an axe-core minor
 * upgrade that adds fields does not break the parse.
 *
 * Anything unusable throws `CoreError` with code `INVALID_AXE_RESULTS`.
 * Callers branch on the code, never on the message.
 */

import { z } from 'zod';

import { CoreError } from './errors.js';

/**
 * A single node target entry: either a plain CSS selector or a nested
 * shadow-DOM/frame path. Only strings survive — anything else is
 * dropped during normalization.
 */
const MAX_TEXT_LENGTH = 100_000;
const MAX_SELECTOR_LENGTH = 10_000;
const MAX_TARGET_DEPTH = 100;
const MAX_TAGS_PER_RULE = 100;
const MAX_NODES_PER_RULE = 10_000;
const MAX_RESULTS_PER_GROUP = 10_000;

const textSchema = z.string().max(MAX_TEXT_LENGTH);
const selectorSchema = z.string().max(MAX_SELECTOR_LENGTH);
const targetEntrySchema = z.union([
  selectorSchema,
  z.array(selectorSchema).max(MAX_TARGET_DEPTH),
]);

const axeNodeSchema = z.object({
  html: textSchema,
  target: z.array(targetEntrySchema).max(MAX_TARGET_DEPTH),
  failureSummary: textSchema.nullish(),
});

const axeResultSchema = z.object({
  id: z.string().min(1).max(1_000),
  impact: z.unknown(),
  tags: z.array(z.string().max(1_000)).max(MAX_TAGS_PER_RULE),
  description: textSchema,
  help: textSchema,
  helpUrl: z.string().max(10_000),
  nodes: z.array(axeNodeSchema).max(MAX_NODES_PER_RULE),
});

/**
 * Top-level axe results shape. All groups are required so malformed or
 * truncated output can never masquerade as a clean 100/A scan. Unknown
 * fields are stripped at every level; core retains only what it consumes.
 */
export const axeResultsSchema = z.object({
  violations: z.array(axeResultSchema).max(MAX_RESULTS_PER_GROUP),
  passes: z.array(axeResultSchema).max(MAX_RESULTS_PER_GROUP),
  incomplete: z.array(axeResultSchema).max(MAX_RESULTS_PER_GROUP),
  inapplicable: z.array(axeResultSchema).max(MAX_RESULTS_PER_GROUP),
});

export type ValidatedAxeResults = z.infer<typeof axeResultsSchema>;
export type ValidatedAxeResult = z.infer<typeof axeResultSchema>;
export type ValidatedAxeNode = z.infer<typeof axeNodeSchema>;

/**
 * Validates untrusted axe-core output and returns the parsed form.
 *
 * @throws {CoreError} with code `INVALID_AXE_RESULTS` when the input
 * is not an axe results object. The Zod issue summary is attached as
 * `cause` for debugging.
 */
export function parseAxeResults(input: unknown): ValidatedAxeResults {
  const parsed = axeResultsSchema.safeParse(input);
  if (!parsed.success) {
    throw new CoreError(
      'INVALID_AXE_RESULTS',
      'Input is not a valid axe-core results object.',
      { cause: parsed.error },
    );
  }

  return parsed.data;
}
