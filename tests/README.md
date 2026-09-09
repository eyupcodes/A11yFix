# Tests

A11yFix features a multi-tiered test suite spanning unit tests, edge-case validation, integration tests, and full end-to-end (E2E) pipeline execution with automated WCAG self-auditing.

## Running Tests

Run all tests across the monorepo:

```bash
pnpm test
```

Run tests for an individual workspace:

```bash
pnpm --filter @a11yfix/core test
pnpm --filter @a11yfix/scanner test
pnpm --filter @a11yfix/reporter test
pnpm --filter @a11yfix/cli test
```

## Test Structure

### 1. `@a11yfix/core`

- **Unit Tests**:
  - `src/findings.test.ts`: axe violation normalization, WCAG criteria mapping, remediation guidance generation.
  - `src/scoring.test.ts`: Penalty calculation, score weighting, and A-F letter grading.
  - `src/schemas.test.ts`: Zod schema enforcement and malformed payload rejection.
- **Edge Cases & Boundaries**:
  - `src/scoring-edge-cases.test.ts`: Node capping (`min(nodeCount, 10)`), score clamping (never < 0, never > 100), boundary grade transitions, best-practice exclusion, and payload fuzzing.

### 2. `@a11yfix/scanner`

- **Unit Tests**:
  - `src/url.test.ts`: Scheme validation, credentials rejection, and local/private network protection.
  - `src/browser.test.ts`: Chromium lifecycle, callback scoping, and error handling.
  - `src/axe.test.ts`: Script injection and error propagation.
- **Integration Tests**:
  - `src/scanner-integration.test.ts`: HTTP redirects (302) via ephemeral loopback server, custom timeouts, subresource failure tolerance, complex DOMs, and Unicode titles.

### 3. `@a11yfix/reporter`

- **Unit Tests**:
  - `src/html.test.ts`: HTML structure, semantic landmarks, badge rendering, accessible color contrast.
  - `src/json.test.ts`: Structured JSON serialization.
  - `src/export.test.ts`: Automatic format detection and file-system writing.
- **Security & Stress Tests**:
  - `src/xss.test.ts`: Exhaustive XSS penetration testing across page titles, URLs, code snippets, selectors, and advice.
  - `src/render-edge-cases.test.ts`: High-density benchmarks (100+ rules, 500+ nodes) and perfect-score edge cases.

### 4. `@a11yfix/cli`

- **Unit Tests**:
  - `src/program.test.ts`: Commander options, arguments, flag validation, and exit code mappings.
  - `src/formatters.test.ts`: Terminal summary layout, score coloring, and tabular breakdown formatting.
- **Integration Tests**:
  - `src/integration.test.ts`: Real file export, stdout JSON serialization, and threshold evaluations.
- **End-to-End & Self-Audit**:
  - `src/e2e.test.ts`: Full pipeline scan (`scanner` → `core` → `reporter` → `cli`). Serves real HTML targets and audits generated HTML reports with axe-core, verifying 0 accessibility violations.
