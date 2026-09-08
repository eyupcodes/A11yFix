# Architecture

A11yFix is a private pnpm/TypeScript monorepo. M1 established workspace and dependency boundaries. M2 adds the low-level scanning engine in `packages/scanner`. M3 adds the core analysis layer in `packages/core`.

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
  - Owns report serialization (JSON), standalone accessible HTML rendering, and file export formats.
  - Depends on core for shared finding representations and validation.
  - Must not depend on CLI or scanner.
- `packages/core` — `@a11yfix/core`
  - Owns normalized findings, WCAG mapping, severity classification, scoring, remediation models, and validation.
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

## Core (M3)

`analyzeAxeResults(results, meta?)` is the single public entry point. The flow is linear, pure, and owns no global state:

```text
unknown axe output
 ↓  schemas.ts — parseAxeResults         (rejects anything unusable)
validated violations / passes / incomplete / inapplicable
 ↓  findings.ts — normalizeFindings      (severity, WCAG, remediation)
deterministically ordered findings       (severity desc, node count desc, rule id asc)
 ↓  scoring.ts — scoreFindings           (penalty, score, grade)
AccessibilityReport { findings, score, grade, breakdown, ruleCounts, meta }
```

Design notes:

- Axe output is treated as untrusted: it is produced inside page content the scanner does not control, so it is validated with Zod before anything reads it. Only the fields M3 consumes are checked; everything else is stripped so axe-core minor upgrades do not break the parse.
- WCAG mapping reads axe rule tags only. Criterion tags (`wcag111` → `1.1.1`) and level tags (`wcag2aa` → WCAG 2.0 AA) are parsed; every other tag family is ignored except `best-practice`, which is surfaced as a flag.
- Missing or unknown `impact` falls back to `moderate` rather than dropping the finding.
- Every failure surfaces as a `CoreError` carrying a stable `code` (`INVALID_AXE_RESULTS`, `UNSUPPORTED_AXE_SHAPE`) and the original `cause`.

### Scoring model

Each conformance finding contributes `severity weight × min(nodeCount, 10)` to a total penalty, subtracted from a perfect 100 and clamped at zero. Severity weights are `critical: 10`, `serious: 5`, `moderate: 2`, `minor: 1`. Grades are `A ≥ 90`, `B ≥ 80`, `C ≥ 70`, `D ≥ 60`, `F` otherwise.

### Best-practice exclusion

Best-practice rules (`accesskeys`, `aria-allowed-attr` without WCAG tags, etc.) test no WCAG success criterion and carry no conformance obligation. They appear in the report as findings but are counted separately in `breakdown.bestPracticeFindings` and never move the conformance score.

## Reporter (M4)

`@a11yfix/reporter` renders validated `AccessibilityReport` objects into serialized output formats and handles file-system export.

```text
AccessibilityReport
 ↓  validate.ts — validateReport        (validates contract before rendering)
 ├→ json.ts — renderJsonReport          (compact or pretty-printed JSON string)
 ├→ html.ts — renderHtmlReport          (self-contained, responsive, accessible HTML5)
 └→ export.ts — writeReport             (auto-detects format, creates dirs, writes file)
```

Design notes:

- **Zero runtime dependencies**: Uses native JavaScript APIs, string builders, and Node.js built-ins (`node:fs/promises`, `node:path`).
- **Defensive validation**: Untrusted inputs are checked against the `AccessibilityReport` contract before processing, failing fast with `ReporterError('INVALID_REPORT')`.
- **Security & XSS Prevention**: All dynamic values (selectors, page titles, URLs, code snippets, failure summaries) are escaped through `escapeHtml` and `escapeAttribute`. Links are checked with `isSafeUrl` to forbid `javascript:` and unsafe protocols. Element snippets are rendered inside `<pre><code>` as escaped text, never unescaped DOM nodes.
- **Accessible HTML**: Generated HTML reports are self-contained with embedded CSS, support dark/light modes via `prefers-color-scheme`, use semantic landmarks (`<header>`, `<main>`, `<section>`, `<article>`), provide high-contrast severity badges, and expose expandable `<details>` elements for inspecting affected DOM nodes.
- **Predictable errors**: All failure modes throw `ReporterError` carrying typed codes: `INVALID_REPORT`, `UNSUPPORTED_FORMAT`, or `FILE_WRITE_FAILED`.

## CLI (M5)

`@a11yfix/cli` exposes the `a11yfix scan <url>` command and coordinates scanner execution, core analysis, report rendering, and file export.

```text
a11yfix scan <url> [options]
 ↓  program.ts — createProgram          (commander argument and flag parsing)
 ↓  scan.ts — executeScan
 ├→ scanner.ts — scanAccessibility      (browser launch, page audit)
 ├→ core — analyzeAxeResults            (normalize, WCAG map, score)
 ├→ reporter — writeReport              (optional file export: -o, --output)
 ├→ reporter — renderJsonReport         (optional raw JSON stdout: --json)
 └→ formatters.ts — formatTerminalSummary (human-readable summary: score, breakdown, findings)
```

Design notes:

- **Commander integration**: CLI options (`-o, --output`, `-f, --format`, `-t, --threshold`, `--timeout`, `--json`, `-q, --quiet`) are parsed with validation guards.
- **Predictable exit codes**:
  - `0` (`EXIT_CODES.SUCCESS`): Scan succeeded and score meets any specified threshold.
  - `1` (`EXIT_CODES.FAILURE`): Score below threshold, or scan/runtime execution failed.
  - `2` (`EXIT_CODES.INVALID_ARGS`): Invalid arguments (out-of-bounds threshold, invalid timeout) or invalid target URL.
- **Terminal output**: Pure formatters render structured summaries including target metadata, score badge, severity counts, violations preview, and threshold evaluation status without external terminal styling libraries.
- **Dependency inversion for I/O**: `executeScan` accepts optional `CliIo` injection (`stdout`, `stderr`), enabling reliable and isolated unit testing.

## Invariants

- No circular workspace dependencies.
- Product behavior remains within its owning package.
- Cross-package contracts flow through core types and validation.
- The scanner returns raw axe results; interpretation happens in core.
