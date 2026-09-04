# Architecture

A11yFix is a private pnpm/TypeScript monorepo. M1 established workspace and dependency boundaries. M2 adds the low-level scanning engine in `packages/scanner`.

## Workspaces

- `apps/cli` — `@a11yfix/cli`
  - Owns command parsing and developer-facing command execution.
  - Composes scanner and reporter behavior into CLI commands.
  - Depends on scanner, reporter, and core.
- `packages/scanner` — `@a11yfix/scanner`
  - Owns Playwright browser automation and axe-core audit execution.
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

## Scanner (M2)

`scanAccessibility(url, options?)` is the single public entry point. The flow is linear and owns no global state:

```text
url
 ↓  url.ts — validateTargetUrl
parsed URL                       (rejects non-http/https, credentials, local/private targets)
 ↓  browser.ts — withChromiumPage
Chromium → context → page        (callback-scoped; closed in `finally` on every path)
 ↓  scanner.ts — scanPage
page.goto(waitUntil: 'domcontentloaded')
 ↓  axe.ts — auditPage
inject axe.source → window.axe.run(document, runOptions)
 ↓
ScanResult { requestedUrl, finalUrl, title, scannedAt, durationMs, axe }
```

Design notes:

- Validation runs before Chromium launches, so a rejected target costs no browser start.
- `networkidle` is deliberately not used; long-lived connections on modern sites can keep it from settling.
- Browser lifetime is scoped to a callback rather than a module-level singleton or a pool.
- Every failure surfaces as a `ScannerError` carrying a stable `code` (`INVALID_URL`, `UNSUPPORTED_PROTOCOL`, `PRIVATE_TARGET`, `BROWSER_LAUNCH_FAILED`, `NAVIGATION_FAILED`, `AXE_INJECTION_FAILED`, `AXE_EXECUTION_FAILED`, `SCAN_FAILED`) and the original `cause`.

### Raw axe result boundary

The scanner returns axe-core's own `AxeResults` unchanged, typed with axe-core's published types. It does not normalize findings, map WCAG criteria, assign severity, score, or produce remediation guidance.

That interpretation layer belongs to `@a11yfix/core` (M3), and rendering belongs to `@a11yfix/reporter` (M4). Keeping the boundary raw means the scanner stays a thin, replaceable audit driver and axe-core's schema is not duplicated across packages.

### URL security scope

URL validation inspects the literal hostname only. It performs no DNS resolution and does not re-validate redirects. The local scanner performs obvious private/local target blocking, but full hosted-service SSRF defense will require DNS resolution and post-resolution validation later.

## Invariants

- No circular workspace dependencies.
- Product behavior remains within its owning package.
- Cross-package contracts flow through core types and validation.
- The scanner returns raw axe results; interpretation happens in core.
