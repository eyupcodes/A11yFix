/**
 * @a11yfix/core foundation entry point.
 *
 * M1 provides only the package boundary so workspace builds,
 * typechecks, and tests can be verified. Shared finding types,
 * validation, and scoring land in later milestones.
 */

export const PACKAGE_NAME = '@a11yfix/core' as const;

export const FOUNDATION_STATUS = 'm1-foundation' as const;
