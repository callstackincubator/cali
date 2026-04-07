# cali

Cali v2 is a QA-oriented CLI for mobile app review runs. Today it ships `cali qa`, a role-based command that keeps deterministic app bootstrap outside the agent, lets the agent inspect and navigate the UI with a narrow tool surface, and publishes a reusable QA report for local and CI workflows.

## Current scope

- `cali qa`
- envs: `mobile-pr`, `local-android`, `local-ios`
- runtime context: one JSON context file plus CLI flag overrides
- tool packs: `skills`, `agent-device`
- publishers: `blob`, `file`
- additive `--prompt`

The surface is intentionally role-based today. Interactive follow-up flows can be added later without changing the env, context, or publisher model.

## Core Concepts

- env: bundles a role with default platform settings, skill paths, enabled tool packs, publishers, and default instructions
- context file: the explicit JSON input that defines the normalized runtime context for a run, including platform, artifact path, app id, build metadata, and output directories
- tool pack: the explicit set of tools exposed to the role, such as `skills` metadata access or `agent-device` UI automation
- publisher: decides how the QA report is exposed after the run, such as writing files locally or uploading blobs

## Examples

### Local env

For local envs, `--artifact` is required and `appId` must come from `--app-id` or `config.appId`. Cali does not infer it from `app.json` yet. `--device` is optional.

```bash
cali qa \
  --env local-ios \
  --artifact ./artifacts/MyApp.app \
  --app-id com.example.myapp \
  --prompt "verify the onboarding copy on Screen B"
```

### Remote env with a context file

For remote environments such as GitHub Actions, EAS workflows, or custom sandboxes, write one normalized JSON context file and override fields only when needed. `mobile-pr` expects that file.

```json
{
  "platform": "android",
  "artifactPath": "./artifacts/app.apk",
  "appId": "com.example.myapp",
  "buildId": "gha-run-123",
  "workflowUrl": "https://github.com/acme/mobile/actions/runs/123",
  "metadata": {
    "prNumber": 42,
    "prTitle": "Fix onboarding CTA",
    "prLabels": ["mobile", "qa"],
    "isDraft": false
  }
}
```

```bash
cali qa --env mobile-pr --context ./qa-context.json
```

Flags always win over the context file. For example, `--platform ios` or `--output-dir ./artifacts/custom` overrides the JSON value.

## Credentials

`cali qa` supports two model auth paths:

- AI Gateway: `AI_GATEWAY_API_KEY`
- AI Gateway alias: `AI_GATEWAY_KEY`
- Anthropic direct: `ANTHROPIC_API_KEY`
- Anthropic alias: `CLAUDE_API_KEY`

Cali defaults to `openai/gpt-5.4-mini`. If gateway credentials are present, that model is routed through AI Gateway. Direct provider support in this package is Anthropic only.

## Config

Create `cali.config.ts` in the project root:

```ts
export default {
  role: 'qa',
  env: 'local-android',
  contextPath: './qa-context.json',
  extraInstructions: ['Prioritize auth and onboarding flows.'],
}
```

By default, Cali discovers skills from:

- `./.agents/skills`
- `~/.agents/skills`

## Package Scripts

The `cali` package exposes handy scripts for the currently implemented `qa` role. Pass additional CLI flags after `--`.

- `bun run qa -- --help`
- `bun run qa:env:local:android -- --artifact ./app.apk --app-id com.example.app`
- `bun run qa:env:local:ios -- --artifact ./MyApp.app --app-id com.example.app`
- `bun run qa:env:mobile-pr -- --context ./qa-context.json`

For development against source instead of the built bundle:

- `bun run dev:qa -- --help`
- `bun run dev:qa:env:local:android -- --artifact ./app.apk --app-id com.example.app`
- `bun run dev:qa:env:local:ios -- --artifact ./MyApp.app --app-id com.example.app`
- `bun run dev:qa:env:mobile-pr -- --context ./qa-context.json`

## Installing Skills

For starter skills, use `npx skills` with the repos we trust:

```bash
npx skills add callstackincubator/agent-device --agent codex --skill '*' -y
npx skills add callstackincubator/agent-skills --agent codex --skill '*' -y
```

This installs project-local skills into `./.agents/skills` and writes `skills-lock.json`.
Project-local and home-directory skills are both picked up automatically by `cali qa`.

## Repo Guide

For implementation details, env guidance, and the roadmap for additional Cali roles in CI or sandbox environments, see [`AGENTS.md`](../../AGENTS.md).

## Outputs

By default the file publisher writes:

- `artifacts/qa/report.json`
- `artifacts/qa/section.md`
- `artifacts/qa/status.txt`

If `BLOB_READ_WRITE_TOKEN` is set, the blob publisher uploads screenshots and enriches the JSON report with blob URLs.
