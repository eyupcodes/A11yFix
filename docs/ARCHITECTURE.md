# Architecture

A11yFix is a private pnpm/TypeScript monorepo. M1 establishes workspace and dependency boundaries without implementing product behavior.

## Workspaces

- `apps/cli` — `@a11yfix/cli`
  - Owns command parsing and developer-facing command execution.
  - Composes scanner and reporter behavior into CLI commands.
  - Depends on scanner, reporter, and core.
- `packages/scanner` — `@a11yfix/scanner`
  - Will own Playwright browser automation and axe-core audit execution.
  - Depends on core for shared finding representations and validation.
  - Must not depend on CLI or reporter.
- `packages/reporter` — `@a11yfix/reporter`
  - Will own report normalization, rendering, and export formats.
  - Depends on core for shared finding representations.
  - Must not depend on CLI or scanner.
- `packages/core` — `@a11yfix/core`
  - Will own normalized findings, WCAG mapping, severity classification, scoring, remediation models, and validation.
  - Must not depend on CLI, scanner, or reporter.

## Dependency direction

```text
CLI
 ↓
scanner
 ↓
core

reporter
 ↓
core
```

The CLI may depend on both scanner and reporter. Scanner and reporter each depend only on core. Core has no workspace dependencies.

## Invariants

- No circular workspace dependencies.
- Product behavior remains within its owning package.
- Cross-package contracts flow through core types and validation.
- M1 contains minimal buildable entry points only.
