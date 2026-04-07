# AGENTS.md

Minimal operating guide for AI coding agents in this repo.

## First 60 Seconds

- Classify the task:
  - Info-only: do not edit code or run checks unless needed.
  - Code change: make the smallest scoped edit and run the lightest relevant validation.
- Read at most 3 files first:
  - the owning command, role, or env adapter
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
- Config and presets:
  - `packages/cali/src/config/schema.ts`
  - `packages/cali/src/config/load.ts`
- Environment adapters:
  - `packages/cali/src/env/local.ts`
  - `packages/cali/src/env/eas.ts`
  - `packages/cali/src/env/github-actions.ts`
  - `packages/cali/src/env/json-file.ts`
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

## Preset Model

Presets should stay thin.

- A preset should define:
  - role
  - environment adapter
  - default platform settings
  - enabled tool packs
  - output publishers
  - extra instructions
- A preset should not add one-off special logic to the command path.
- If a new remote environment is needed, prefer a new env adapter over branching inside `qa.ts`.

Current built-in presets:

- `local-android`
- `local-ios`
- `eas-mobile-pr`
- `github-actions-pr`

## Adding a New Environment Adapter

Use this order:

1. Add the adapter name to `packages/cali/src/config/schema.ts`.
2. Implement `packages/cali/src/env/<name>.ts`.
3. Route it in `packages/cali/src/commands/qa.ts`.
4. Add a preset in `packages/cali/src/config/load.ts`.
5. Update `packages/cali/README.md`.

Keep adapters small. They should only normalize context:

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
- For env adapter or preset changes:
  - run at least one preset smoke command if credentials and local tooling exist

Do not commit generated `artifacts/` output.

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

- Prefer one small adapter over branching logic inside the command.
- Prefer one role file over abstract role frameworks.
- Prefer docs that explain current behavior clearly over speculative docs for future behavior.
- If a planned role needs a different tool surface or output contract, document it first before implementing shared abstractions.
