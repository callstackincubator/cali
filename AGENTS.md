# AGENTS.md

Minimal operating guide for AI coding agents in this repo.

## First 60 Seconds

- Classify the task:
  - Info-only: do not edit code or run checks unless needed.
  - Code change: make the smallest scoped edit and run the lightest relevant validation.
- Read at most 3 files first:
  - the owning command, role, or context loader
  - one shared config or helper file
  - one relevant doc file if the task changes CLI behavior
- Define concrete success criteria before editing.
- Prefer package docs and code over guessing current behavior.

## Repo Shape

- `packages/cali`: the standalone CLI, currently centered on `cali qa`
- `packages/tools`: reusable Cali tools for other agent runtimes
- `packages/mcp-server`: MCP wrapper over the tools package

## Cali v2 Architecture

The `cali` package is role-oriented.

- CLI entry:
  - `packages/cali/src/cli.ts`
  - `packages/cali/src/cli/app.ts`
  - `packages/cali/src/cli/qa.ts`
- Runtime orchestration:
  - `packages/cali/src/commands/qa.ts`
- Config and env defaults:
  - `packages/cali/src/config/schema.ts`
  - `packages/cali/src/config/load.ts`
- Runtime context loaders:
  - `packages/cali/src/env/local.ts`
  - `packages/cali/src/env/context-file.ts`
- Role implementation:
  - `packages/cali/src/roles/qa-mobile.ts`
- Tool packs:
  - `packages/cali/src/tools/agent-device.ts`
  - `packages/cali/src/tools/skills.ts`
- Reports and publishers:
  - `packages/cali/src/report/types.ts`
  - `packages/cali/src/report/render.ts`
  - `packages/cali/src/report/publishers/file.ts`
  - `packages/cali/src/report/publishers/blob.ts`

## Current Role

- Implemented:
  - `qa`
- Role contract:
  - deterministic bootstrap stays in the CLI command
  - the agent inspects and navigates the app only after bootstrap
  - reports are written through the standard QA report schema
  - publishers decide how outputs are exposed

## Env Model

Envs should stay thin.

- An env should define:
  - role
  - default platform settings
  - enabled tool packs
  - output publishers
  - extra instructions
- An env should not add one-off special logic to the command path.
- Runtime context should come from one normalized JSON file plus CLI overrides, not from workflow-specific `process.env` scraping.
- If a new remote workflow is needed, prefer generating the same JSON context upstream rather than adding another workflow-specific loader.

Current built-in envs:

- `local-android`
- `local-ios`
- `mobile-pr`

## Runtime Context

Use this order when changing the runtime context contract:

1. Update the normalized schema in `packages/cali/src/env/context-file.ts`.
2. Keep CLI flags as explicit overrides for that schema.
3. Update `packages/cali/src/env/local.ts` only if local fallback behavior changes.
4. Update env defaults in `packages/cali/src/config/load.ts` if the role behavior changes.
5. Update `packages/cali/README.md`.

Keep the context small and explicit. It should cover:

- platform
- artifact path
- app id
- build and workflow metadata
- output directories
- device name
- PR or task metadata

## Adding a New Role

Use this order:

1. Add the role module under `packages/cali/src/roles/`.
2. Keep bootstrap outside the role.
3. Expose only explicit tool packs.
4. Define one structured output contract.
5. Document the role prompt and intended runtime in `packages/cali/README.md`.

Avoid role-specific branching in shared helpers when a small role module will do.

## Validation

- For `packages/cali` TypeScript changes:
  - `bunx tsc --noEmit -p packages/cali/tsconfig.json`
- For build or runtime changes:
  - `bun run build`
- For CLI surface changes:
  - `node packages/cali/dist/index.js qa --help`
- For env or context contract changes:
  - run at least one env smoke command if credentials and local tooling exist

Do not commit generated `artifacts/` output.

## Handy Scripts

When working in `packages/cali`, prefer the package scripts over reconstructing CLI commands:

- built bundle:
  - `bun run qa -- --help`
  - `bun run qa:env:local:android -- --artifact ./app.apk --app-id com.example.app`
  - `bun run qa:env:local:ios -- --artifact ./MyApp.app --app-id com.example.app`
  - `bun run qa:env:mobile-pr -- --context ./qa-context.json`
- source/dev loop:
  - `bun run dev:qa -- --help`
  - `bun run dev:qa:env:local:android -- --artifact ./app.apk --app-id com.example.app`
  - `bun run dev:qa:env:local:ios -- --artifact ./MyApp.app --app-id com.example.app`
  - `bun run dev:qa:env:mobile-pr -- --context ./qa-context.json`

## Documentation Touch Points

When behavior changes, review:

- `packages/cali/README.md`
- `README.md` if package positioning changed
- this file if agent workflow or repo guidance changed
- PR body if the branch story materially changed

## Agent Roadmap

These roles are good next candidates for remote environments such as CI, ephemeral sandboxes, and device-backed mobile workflows.

### `qa` (implemented)

Use for:

- user-visible flow verification on installed builds
- PR smoke checks in EAS or GitHub Actions
- screenshot-backed QA summaries

Prompt shape:

```text
You are a mobile QA agent for React Native and Expo builds.
Treat bootstrap as already handled.
Inspect the app with the provided device tools only.
Prioritize user-visible flows and concise acceptance criteria from PR or task metadata.
Capture screenshots for meaningful states.
Do not inspect source code or modify the repository.
Finish by writing one structured QA report.
```

### `dev-mobile` (planned)

Use for:

- sandboxed implementation tasks on React Native or Expo apps
- targeted bug fixes with local validation
- feature work where code inspection and editing are allowed

Prompt shape:

```text
You are a React Native and Expo development agent working in a sandboxed repository.
Start from the user task, repo scripts, and current project state.
Inspect only the files needed to understand the issue.
Make the smallest code change that solves the problem.
Prefer existing scripts and project conventions over ad hoc commands.
Validate with the lightest checks that prove the change.
Summarize the fix, the files changed, and the exact validation run.
```

### `review-mobile-pr` (planned)

Use for:

- PR review in CI or a sandbox without making changes
- regression and risk analysis for React Native or Expo code
- architecture, platform, and maintainability review

Prompt shape:

```text
You are a mobile code review agent for React Native and Expo pull requests.
Review the diff and any attached build or QA context.
Prioritize correctness risks, platform regressions, missing validation, and maintainability concerns.
Do not suggest broad rewrites when a targeted concern is enough.
Output findings first, ordered by severity, with file references and short rationale.
If there are no concrete findings, say so explicitly and note any residual risk.
```

### `ci-debug-mobile` (planned)

Use for:

- failing GitHub Actions, EAS, or other remote mobile pipelines
- broken build, install, test, or runtime automation in CI
- diagnosis-first workflows where logs and artifacts matter more than code edits

Prompt shape:

```text
You are a CI debugging agent for React Native and Expo workflows.
Start from the failing job, logs, and environment metadata.
Identify the first concrete failure, not downstream noise.
Explain whether the root cause is code, configuration, environment, credentials, or infrastructure.
If a code or config fix is safe and local, implement the smallest one.
Otherwise, produce a short unblock plan with the exact environment inputs required.
```

### `upgrade-mobile` (planned)

Use for:

- React Native upgrades
- Expo SDK upgrades
- library compatibility sweeps in a sandbox

Prompt shape:

```text
You are a React Native and Expo upgrade agent.
Treat upgrades as compatibility work, not greenfield refactoring.
Start from the requested target version and the current repo state.
Apply the minimum set of changes needed to get the project building and typechecking again.
Call out manual follow-ups separately from the automated patch.
Validate with version-appropriate build and type checks.
```

## Keep It Simple

- Prefer one normalized context contract over multiple workflow-specific loaders.
- Prefer one role file over abstract role frameworks.
- Prefer docs that explain current behavior clearly over speculative docs for future behavior.
- If a planned role needs a different tool surface or output contract, document it first before implementing shared abstractions.
