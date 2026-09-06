/**
 * WCAG extraction from axe-core rule tags.
 *
 * Axe tags encode two orthogonal facts: the success criteria a rule tests
 * (`wcag111` → criterion 1.1.1) and the conformance level of the rule
 * (`wcag2aa` → WCAG 2.0 AA). Every other tag family (`cat.*`,
 * `best-practice`, `section508*`, `EN-*`, `ACT`, …) carries no WCAG
 * obligation and is ignored here — except `best-practice`, which is
 * surfaced as a flag because best-practice rules must not be scored as
 * conformance failures.
 *
 * This module is pure: no I/O, no global state.
 */

import type {
  WcagCriterion,
  WcagLevel,
  WcagMapping,
  WcagVersion,
} from './types.js';

/**
 * Parses `wcag` + digits tags such as `wcag111` or `wcag1412`.
 *
 * Layout: first digit = principle, second digit = guideline, the
 * remainder = success criterion (`wcag1412` → `1.4.12`). Returns null
 * for anything else — level tags (`wcag2aa`), the obsolete marker
 * (`wcag2a-obsolete`), and non-WCAG tags.
 */
export function parseCriterionTag(tag: string): WcagCriterion | null {
  const match = /^wcag(\d)(\d)(\d+)$/.exec(tag);
  if (match === null) {
    return null;
  }

  const [, principle = '', guideline = '', criterion = ''] = match;
  return `${principle}.${guideline}.${criterion}`;
}

interface LevelTag {
  readonly version: WcagVersion;
  readonly level: WcagLevel;
}

const LEVEL_TAG_PATTERN = /^wcag(22|21|2)(aaa|aa|a)$/;

const WCAG_VERSIONS: Record<string, WcagVersion> = {
  2: '2.0',
  21: '2.1',
  22: '2.2',
};

/**
 * Parses level tags such as `wcag2aa` or `wcag21a`. Returns null for
 * criterion tags, `wcag2a-obsolete`, and everything non-WCAG.
 */
export function parseLevelTag(tag: string): LevelTag | null {
  const match = LEVEL_TAG_PATTERN.exec(tag);
  if (match === null) {
    return null;
  }

  const [, versionDigits = '', rawLevel = ''] = match;
  const version = WCAG_VERSIONS[versionDigits];
  if (version === undefined) {
    return null;
  }

  const level = rawLevel.toUpperCase();
  if (level !== 'A' && level !== 'AA' && level !== 'AAA') {
    return null;
  }

  return { version, level };
}

const LEVEL_RANK: Record<WcagLevel, number> = { A: 0, AA: 1, AAA: 2 };
const VERSION_RANK: Record<WcagVersion, number> = {
  '2.0': 0,
  '2.1': 1,
  '2.2': 2,
};

function compareCriteria(a: WcagCriterion, b: WcagCriterion): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let index = 0; index < Math.max(aParts.length, bParts.length); index++) {
    const diff = (aParts[index] ?? 0) - (bParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

/**
 * Extracts the WCAG mapping from an axe rule tag list.
 *
 * Criteria are sorted numerically (`1.4.12` after `1.4.3`, not before)
 * and de-duplicated. When several level tags apply, the highest level
 * wins and its version is reported.
 */
export function extractWcag(tags: readonly string[]): WcagMapping {
  const criteria = new Set<WcagCriterion>();
  let best: LevelTag | null = null;

  for (const tag of tags) {
    const criterion = parseCriterionTag(tag);
    if (criterion !== null) {
      criteria.add(criterion);
      continue;
    }

    const levelTag = parseLevelTag(tag);
    if (levelTag === null) {
      continue;
    }

    const isHigherLevel =
      best === null || LEVEL_RANK[levelTag.level] > LEVEL_RANK[best.level];
    const isNewerAtSameLevel =
      best !== null &&
      LEVEL_RANK[levelTag.level] === LEVEL_RANK[best.level] &&
      VERSION_RANK[levelTag.version] > VERSION_RANK[best.version];

    if (isHigherLevel || isNewerAtSameLevel) {
      best = levelTag;
    }
  }

  return {
    criteria: [...criteria].sort(compareCriteria),
    level: best?.level ?? null,
    version: best?.version ?? null,
    isBestPractice: tags.includes('best-practice'),
  };
}
