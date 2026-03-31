# cali

Cali v2 is a QA-oriented CLI for mobile app review runs. Today it ships `cali qa`, a role-based command that keeps deterministic app bootstrap outside the agent, lets the agent inspect and navigate the UI with a narrow tool surface, and publishes a reusable QA report for local and CI workflows.

## Current scope

- `cali qa`
- presets: `eas-mobile-pr`, `local-android`, `local-ios`
- environment adapters: EAS env, local flags, JSON context
- tool packs: `skills`, `agent-device`
- publishers: `blob`, `file`
- additive `--prompt`

The surface is intentionally role-based today. Interactive follow-up flows can be added later without changing the preset, adapter, or publisher model.

## Core Concepts

- preset: bundles a role with default platform settings, an environment adapter, skill paths, enabled tool packs, and publishers
- environment adapter: resolves the normalized runtime context for a run, including platform, artifact path, app id, build metadata, and output directories
- tool pack: the explicit set of tools exposed to the role, such as `skills` metadata access or `agent-device` UI automation
- publisher: decides how the QA report is exposed after the run, such as writing files locally or uploading blobs

## Examples

### Local preset

For local presets, `--artifact` is required and `appId` must come from `--app-id`, `config.appId`, or `APPLICATION_ID`. Cali does not infer it from `app.json` yet. `--device` is optional.

```bash
cali qa \
  --preset local-ios \
  --artifact ./artifacts/MyApp.app \
  --app-id com.example.myapp \
  --device "iPhone 16" \
  --prompt "verify the onboarding copy on Screen B"
```

### EAS preset

For `eas-mobile-pr`, you usually do not pass `--artifact` or `--app-id` on the command line. The EAS adapter reads them from `APP_PATH` and `APPLICATION_ID`, and it reads the platform from `QA_PLATFORM` unless you override it with `--platform`.

```bash
cali qa --preset eas-mobile-pr
```

## Credentials

`cali qa` supports two model auth paths:

- AI Gateway: `AI_GATEWAY_API_KEY`
- AI Gateway alias: `AI_GATEWAY_KEY`
- Anthropic direct: `ANTHROPIC_API_KEY`
- Anthropic alias: `CLAUDE_API_KEY`

Cali defaults to `openai/gpt-5.4-mini`.
If gateway credentials are present, that model is routed through AI Gateway.
Direct provider support in this package is Anthropic only.

## Config

Create `cali.config.ts` in the project root:

```ts
export default {
  role: 'qa',
  preset: 'local-android',
  extraInstructions: ['Prioritize auth and onboarding flows.'],
}
```

By default, Cali discovers skills from:

- `./.agents/skills`
- `~/.agents/skills`

## Installing Skills

For starter skills, use `npx skills` with the repos we trust:

```bash
npx skills add callstackincubator/agent-device --agent codex --skill '*' -y
npx skills add callstackincubator/agent-skills --agent codex --skill '*' -y
```

This installs project-local skills into `./.agents/skills` and writes `skills-lock.json`.
Project-local and home-directory skills are both picked up automatically by `cali qa`.

## Outputs

By default the file publisher writes:

- `artifacts/qa/report.json`
- `artifacts/qa/section.md`
- `artifacts/qa/status.txt`

If `BLOB_READ_WRITE_TOKEN` is set, the blob publisher uploads screenshots and enriches the JSON report with blob URLs.
