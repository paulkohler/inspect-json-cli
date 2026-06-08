# AGENTS.md

This repo is a small local developer tool for inspecting JSON-heavy AI logs.

## Rules

- Use Node.js 22+ built-ins only.
- Keep ESM.
- Do not add runtime or dev dependencies.
- Add native `node:test` coverage for behavior changes.
- Keep the CLI readable and pipe-friendly.
- Treat input as untrusted data.
- Prefer deterministic text output over terminal control sequences.
- Color is allowed by default for TTY output, but every colorized view must have
  a plain `--no-color` equivalent.
- Keep strategies, filters, and transformers explicit so special cases do not
  become scattered conditionals.
- Always use braces for control-flow bodies; no single-line `if (x) doThing();`.
  Biome's `useBlockStatements` lint rule enforces this.

## Tooling

- Formatting and linting use [Biome](https://biomejs.dev), expected on `PATH`
  (installed globally, not as a dev dependency). Config lives in `biome.jsonc`.
- `npm run format` applies formatting; `npm run lint` lints; `npm run check`
  also runs Biome after the syntax check.

## Commands

- `npm test`
- `npm run check`
- `npm run format`

