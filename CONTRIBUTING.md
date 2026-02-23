# Contributing to leashed

Thanks for your interest in contributing.

## Getting Started

```bash
git clone https://github.com/dormstern/leashed.git
cd leashed
npm install
npm run build
npm test
```

No AnchorBrowser API key is needed for development — all tests run against mocked sessions.

## Making Changes

1. Fork the repo and create a branch from `main`
2. Write or update tests for your changes
3. Run `npm test` to make sure everything passes
4. Run `npm run build` to verify TypeScript compilation
5. Open a pull request

## Project Structure

```
src/
  index.ts        # createLeash() — main entry point
  policy.ts       # Pattern matching + deny-first evaluation
  session.ts      # AnchorBrowser session lifecycle
  audit.ts        # JSONL audit log
  output-scanner.ts # Post-execution output scanning
  cli.ts          # npx leashed commands
  types.ts        # TypeScript types
  constants.ts    # Shared constants
tests/
  leash.test.ts   # Integration tests (mocked AnchorBrowser)
  policy.test.ts  # Policy evaluation unit tests
  audit.test.ts   # Audit log unit tests
  cli.test.ts     # CLI unit tests
  output-scanner.test.ts # Output scanner tests
examples/
  leash.yaml      # Example policy file
  basic.ts        # Minimal usage example
  openclaw-inbox.ts # OpenClaw inbox agent example
```

## Coding Standards

- TypeScript strict mode
- Tests via Vitest
- No runtime dependencies beyond `anchorbrowser`, `js-yaml`, `picomatch`
- Fail closed — errors are reported as blocked, never silently swallowed

## Reporting Bugs

Use the [bug report template](https://github.com/dormstern/leashed/issues/new?template=bug_report.md). Include your policy config and Node version.

## Security Vulnerabilities

Do **not** file a public issue for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
