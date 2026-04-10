# AGENTS.md

Minimal operating guide for AI coding agents in this repo.

## First 60 Seconds

- Classify the task:
  - Info-only: do not edit code or run checks unless needed.
  - Code change: make the smallest scoped edit and run the lightest relevant validation.
- Read at most 4 files first:
  - the owning command module
  - one role module
  - one shared runtime file
  - one relevant doc file if the CLI or context contract changes
- Define concrete success criteria before editing.
- Prefer the shared runtime contracts over command-local improvisation.

## Repo Shape

- `packages/cali`: standalone CLI role platform
- `packages/tools`: reusable Cali tools for other runtimes

## Cali Runtime Shape

The `cali` package is now a small role platform.

- CLI entry:
  - `packages/cali/src/cli.ts`
  - `packages/cali/src/cli/app.ts`
  - `packages/cali/src/cli/*.ts`
- Command orchestration:
  - `packages/cali/src/commands/*.ts`
- Shared runtime:
  - `packages/cali/src/runtime/types.ts`
  - `packages/cali/src/runtime/context.ts`
  - `packages/cali/src/runtime/tool-packs.ts`
  - `packages/cali/src/runtime/tool-loop-role.ts`
  - `packages/cali/src/runtime/publishers.ts`
  - `packages/cali/src/runtime/mobile.ts`
- Config:
  - `packages/cali/src/config/schema.ts`
  - `packages/cali/src/config/load.ts`
- Roles:
  - `packages/cali/src/roles/*.ts`
- Tool packs:
  - `packages/cali/src/tools/*.ts`
- Reports:
  - `packages/cali/src/report/types.ts`
  - `packages/cali/src/report/render.ts`
  - `packages/cali/src/report/publishers/*.ts`

## Public Commands

Implemented first-class commands:

- `qa`
- `review`
- `perf-review`
- `dev`

Current maturity:

- `qa`: ship-ready
- `review`: experimental
- `perf-review`: experimental
- `dev`: experimental

`publish` is intentionally not implemented. Release automation belongs in CI or in `dev`-driven pipeline work, not as an open-ended agent command.

## Core Contracts

### Env

`env` is the only preset concept.

Built-in envs:

- `mobile-pr`
- `eas-mobile-pr`
- `local-android`
- `local-ios`

An env sets defaults such as tool packs, publishers, and mobile defaults. It must not introduce workflow-specific runtime scraping.

### Context

All commands use one shared `cali-context.json` contract.

Keep the shared context focused on:

- `workspaceRoot`
- `repository`
- `task`
- `pullRequest`
- `mobile`
- `build`
- `output`
- role-specific optional sections:
  - `qa`
  - `review`
  - `perfReview`
  - `dev`

If a new workflow needs more data, extend the shared context schema in `packages/cali/src/runtime/context.ts` instead of adding a new workflow-specific loader.

### Tool Packs

Built-in pack ids:

- `skills`
- `agent-device`
- `repo-read`
- `repo-write`
- `react-devtools`

Required skill guidance should be preloaded through the tool-pack registry when a pack depends on a skill workflow. Do not push that responsibility into individual prompts by hand.

## Command Guidance

### `qa`

- Bootstrap stays outside the role in the command module.
- The role inspects the app and writes a structured QA report.
- Use `--ci github-actions|eas` for CI runs.
- Use `--env local-android|local-ios` for local runs.
- Requires `agent-device` on `PATH`.
- Mobile runs use a unique per-run `agent-device` session. Do not reuse ambient sessions.
- Local envs are convenience-first: try `open --relaunch` before reinstalling.
- Local mobile runs can infer the app id from the artifact. Do not require `--app-id` unless inference fails.
- If `--device` is omitted, reuse the single booted local target when exactly one exists; otherwise fail clearly.
- Acceptance criteria resolve in this order:
  - `context.qa.acceptanceCriteria`
  - `context.pullRequest.body`
  - `context.task.body`
  - additive CLI prompt

### `review`

- No code changes.
- Findings first.
- Prefer repository/diff evidence over generic advice.

### `perf-review`

- Uses both `agent-device` and `react-devtools`.
- Requires `agent-device` and `agent-react-devtools` on `PATH`.
- Focus on runtime evidence, not speculative optimizations.

### `dev`

- Smallest code change that solves the task.
- Repository tools rely on `git`, `rg`, and `zsh` being available.
- Respect `context.dev.writePolicy` and `context.dev.pushPolicy`.

## Validation

- For `packages/cali` TypeScript changes:
  - `bunx tsc --noEmit -p packages/cali/tsconfig.json`
- For `packages/tools` TypeScript changes:
  - `bunx tsc --noEmit -p packages/tools/tsconfig.json`
- For build or runtime changes:
  - `bun run build:cli`
  - `bun run build:tools` when `packages/tools` changes
- For CLI surface changes:
  - `node packages/cali/dist/index.js --help`
  - relevant `--help` command smoke tests
- For command/runtime changes:
  - run at least one source-mode smoke command if possible
- For docs/setup changes:
  - keep `packages/cali/README.md` copy-pasteable for provider setup and CI examples

Do not commit generated `artifacts/` output.

## Handy Scripts

Built bundle:

- `bun run qa -- --help`
- `bun run review -- --help`
- `bun run perf-review -- --help`
- `bun run dev:command -- --help`
- `bun run qa:ci:gha -- --platform android --artifact ./artifacts/app.apk`
- `bun run qa:ci:eas -- --platform ios --artifact ./artifacts/MyApp.app`
- `bun run export-ci -- --report ./artifacts/qa/report.json`

Source/dev loop:

- `bun run dev:qa -- --help`
- `bun run dev:review -- --help`
- `bun run dev:perf-review -- --help`
- `bun run dev:dev-command -- --help`

## Extending Cali

When adding a new command:

1. Add the CLI command module under `packages/cali/src/cli/`.
2. Add the orchestration module under `packages/cali/src/commands/`.
3. Add the role module under `packages/cali/src/roles/`.
4. Register tool packs in `packages/cali/src/runtime/tool-packs.ts`.
5. Extend the shared report contract and renderer only as much as needed.
6. Update `packages/cali/README.md` and this file.

Prefer small, explicit contracts:

- one shared context model
- one command registry
- one publisher pipeline
- command-specific role prompts and output schemas

## Keep It Simple

- Prefer one normalized context contract over workflow-specific loaders.
- Prefer one small tool-pack addition over command-local shell wrappers.
- Prefer one role file per command over broad abstract “agent frameworks”.
- Prefer accurate docs for the current command surface over speculative future docs.
