# Contributing

## Installation

Prerequisites:

- Node.js 20 or newer
- pnpm 10

Install workspace dependencies from the repository root:

```sh
pnpm install
```

## Required checks

Run every check before requesting review:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Do not submit changes with failing checks unless the failure is pre-existing, unrelated, and explicitly documented.

## Branch naming

Use short, descriptive branch names with one of these prefixes:

- `feature/`
- `fix/`
- `docs/`
- `chore/`
- `refactor/`
- `test/`

Examples:

```text
feature/multi-page-crawl
fix/html-report-escaping
docs/cli-examples
chore/update-playwright
```

## Pull request expectations

- Keep the scope focused on one change.
- Describe behavior, validation, and remaining risks.
- Include tests for behavior changes.
- Keep generated output and local reports out of the pull request.
- Update README, architecture, roadmap, or setup documentation when behavior, contracts, or workflows change.
- Resolve lint, typecheck, test, build, and formatting failures before review.
