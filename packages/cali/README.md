# cali

Cali v2 is a role-oriented CLI for mobile React Native and Expo workflows. It runs first-class agent commands on top of a shared runtime model:

- commands: `qa`, `review`, `perf-review`, `dev`
- local mobile mode: `--local android|ios`
- CI mode: implicit detection with optional `--ci github-actions|eas` override
- one shared `cali-context.json` runtime contract
- explicit tool packs per command
- publisher-based outputs
- additive `--prompt`

## Core Concepts

- command: the user-facing role entrypoint such as `cali qa` or `cali review`
- local: local mobile mode selector for `qa` and `perf-review`
- context file: the optional explicit JSON input for workspace, repository, PR/task, mobile, build, output, and role-specific sections
- tool pack: a bounded capability surface such as `agent-device`, `react-devtools`, `repo-read`, or `repo-write`
- publisher: how reports are exposed after a run, such as `file` or `blob`

## Commands

- `cali qa`
  - mobile QA pass with `agent-device`
- `cali review`
  - findings-first PR/repository review (experimental)
- `cali perf-review`
  - runtime performance review with `agent-device` and `react-devtools` (experimental)
- `cali dev`
  - repository-backed implementation flow (experimental)

## Shared Context

All commands use one shared `cali-context.json` contract. Commands only require the sections they actually use.

```json
{
  "workspaceRoot": ".",
  "repository": {
    "provider": "github.com",
    "owner": "acme",
    "name": "mobile-app",
    "webUrl": "https://github.com/acme/mobile-app",
    "defaultBranch": "main",
    "currentBranch": "feature/onboarding-copy"
  },
  "pullRequest": {
    "number": 42,
    "title": "Fix onboarding CTA",
    "body": "Acceptance criteria: the new CTA copy is visible on Screen B.",
    "url": "https://github.com/acme/mobile-app/pull/42",
    "labels": ["mobile", "qa"],
    "isDraft": false,
    "baseBranch": "main",
    "headBranch": "feature/onboarding-copy"
  },
  "mobile": {
    "platform": "android",
    "artifactPath": "./artifacts/app.apk",
    "appId": "com.example.myapp",
    "deviceName": "Pixel 9"
  },
  "build": {
    "id": "gha-run-123",
    "workflowUrl": "https://github.com/acme/mobile-app/actions/runs/123",
    "logsUrl": "https://github.com/acme/mobile-app/actions/runs/123/job/456"
  },
  "output": {
    "outputDir": "./artifacts/qa"
  },
  "qa": {
    "acceptanceCriteria": ["Screen B shows the updated CTA copy", "The CTA remains tappable"]
  },
  "perfReview": {
    "targetFlow": "Checkout",
    "profilingGoals": ["rerenders", "slow interactions"]
  },
  "dev": {
    "allowedValidations": ["bun test", "bunx tsc --noEmit"],
    "writePolicy": "workspace",
    "pushPolicy": "disabled"
  }
}
```

Flags always win over the context file. For example, `--platform`, `--artifact`, `--app-id`, `--output-dir`, `--pr-number`, or `--task-id` override the JSON values. For local mobile runs, `--app-id` is optional when Cali can infer it from the artifact.

For safety, Cali sanitizes credential-bearing repository URLs when loading context and publishes a reduced safe context in `report.json` by default.

## Examples

### Local QA

```bash
cali qa \
  --local ios \
  --artifact ./artifacts/MyApp.app \
  --prompt "verify the onboarding copy on Screen B"
```

Local mobile behavior:

- each run gets a unique `agent-device` session name such as `ios-a1b2c`
- local Android reuses the single booted emulator/device when exactly one is available, otherwise pass `--device`
- local runs try `open --relaunch` before reinstalling
- local iOS reuses the single booted simulator when exactly one is available, otherwise pass `--device`

### CI-native commands

```bash
cali qa --platform ios --artifact ./artifacts/MyApp.app
cali qa --platform android --artifact ./artifacts/app.apk
cali review --context ./cali-context.json
```

In GitHub Actions and EAS, Cali detects the provider automatically from the environment. Use `--ci` only to override detection. Use `--local android|ios` for local mobile runs.

Use `--quiet` to suppress the retro banner in scripted environments. Cali also suppresses the banner automatically when `CI=true`.

### Runtime performance review

```bash
cali perf-review \
  --context ./cali-context.json \
  --platform android \
  --artifact ./artifacts/app.apk \
  --prompt "profile the checkout flow"
```

### Repo-backed implementation

```bash
cali dev --context ./cali-context.json --prompt "implement issue 123"
```

## Provider Setup

Cali supports two model auth paths:

### AI Gateway

```bash
export AI_GATEWAY_API_KEY="your-ai-gateway-key"
export QA_MODEL="openai/gpt-5.4-mini"
```

### Anthropic Direct

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export QA_MODEL="anthropic/claude-sonnet-4.6"
```

### `.env` example

```dotenv
AI_GATEWAY_API_KEY=your-ai-gateway-key
QA_MODEL=openai/gpt-5.4-mini
```

or:

```dotenv
ANTHROPIC_API_KEY=your-anthropic-api-key
QA_MODEL=anthropic/claude-sonnet-4.6
```

`packages/cali` loads `.env` automatically from the current workspace before it starts a run.

Cali defaults to `openai/gpt-5.4-mini`. If gateway credentials are present, that model is routed through AI Gateway. Direct provider support in this package is Anthropic only.

Optional publisher/runtime credentials:

- `BLOB_READ_WRITE_TOKEN` for blob screenshot uploads

## Required CLIs

Some commands shell out to local binaries:

- `qa`: requires `agent-device`
- `perf-review`: requires `agent-device` and `agent-react-devtools`
- `review`: requires `git` and `rg`
- `dev`: requires `git`, `rg`, and `zsh`

Install examples:

```bash
npm i -g agent-device
npm i -g agent-react-devtools
```

On macOS/Linux, Git and `zsh` are usually present already. Install ripgrep if `rg` is missing.

If you want Android app id inference from an `.apk` without passing `--app-id`, Cali now reads `AndroidManifest.xml` directly from the archive. It can also fall back to SDK `aapt` when the manifest is not readable.

If one of these is missing, Cali stops with an actionable error instead of trying to install it automatically.

## Required Skills

Cali discovers local skills from:

- `./.agents/skills`
- `~/.agents/skills`

Required role skills:

- `qa`: `agent-device`
- `perf-review`: `agent-device`, `react-devtools`

Install examples:

```bash
npx skills add callstackincubator/agent-device --agent codex --skill agent-device -y
npx skills add callstackincubator/agent-skills --agent codex --skill react-devtools -y
```

## CI Providers

The CI-native entrypoint is `cali <command>`, with provider detection handled automatically in GitHub Actions and EAS. Use `--ci <provider>` only to override detection.

Supported providers:

- `github-actions`
- `eas`

For CI runs, Cali derives runtime context from provider env plus CLI overrides directly inside the command.

Required provider inputs:

- GitHub Actions:
  - `GITHUB_EVENT_PATH`
  - `CALI_PLATFORM` or `--platform`
  - `CALI_ARTIFACT_PATH` or `--artifact`
  - optional `CALI_APP_ID`
  - optional `CALI_DEVICE_NAME`
  - optional `CALI_OUTPUT_DIR`
- EAS:
  - `QA_PLATFORM` or `--platform`
  - `APP_PATH` or `--artifact`
  - optional `APPLICATION_ID`
  - optional `CALI_DEVICE_NAME`
  - optional `BUILD_ID`
  - optional `WORKFLOW_URL`
  - optional `LOGS_URL`
  - optional `PR_JSON`

## CI Helpers

Core CI command:

```bash
cali qa --quiet --platform ios --artifact ./artifacts/MyApp.app
cali qa --quiet --platform android --artifact ./artifacts/app.apk
```

Optional helpers:

```bash
cali export-ci --report ./artifacts/qa/report.json
cali export-ci --android ./artifacts/android/report.json --ios ./artifacts/ios/report.json
```

### GitHub Actions

Minimal GitHub Actions example:

```yaml
- name: Install required CLIs
  run: npm i -g agent-device

- name: Run Cali QA
  env:
    AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
    CALI_PLATFORM: android
    CALI_ARTIFACT_PATH: ${{ steps.download_build.outputs.artifact_path }}
    CALI_APP_ID: com.example.myapp
  run: node ./packages/cali/dist/index.js qa --quiet

- name: Export CI comment
  run: node ./packages/cali/dist/index.js export-ci --report ./artifacts/qa/report.json

- name: Publish PR comment
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: gh pr comment "${{ github.event.pull_request.number }}" --body-file ./artifacts/qa/ci-comment.md
```

`gh` is preinstalled on GitHub-hosted runners. For self-hosted runners or container jobs, install it explicitly and provide `GH_TOKEN`.

Reference wrapper:
- [`packages/cali/examples/github-actions/run-qa.sh`](./examples/github-actions/run-qa.sh)

### EAS Workflows

Minimal EAS example:

```yaml
- id: install_agent_device
  run: npm i -g agent-device

- id: run_cali_qa
  env:
    AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
    QA_PLATFORM: android
    APP_PATH: ${{ steps.download_build.outputs.artifact_path }}
    APPLICATION_ID: dev.expo.myapp
    BUILD_ID: ${{ env.BUILD_ID }}
    WORKFLOW_URL: ${{ workflow.url }}
    PR_JSON: ${{ toJSON(github.event.pull_request) }}
  run: node ./packages/cali/dist/index.js qa --quiet

- id: export_cali_ci
  run: node ./packages/cali/dist/index.js export-ci --report ./artifacts/qa/report.json
```

Reference wrapper:
- [`packages/cali/examples/eas-workflows/run-qa.sh`](./examples/eas-workflows/run-qa.sh)

For multi-platform PR comments, export once from both platform reports:

```bash
cali export-ci \
  --android ./artifacts/android/report.json \
  --ios ./artifacts/ios/report.json \
  --output-dir ./artifacts/combined-comment
```

If you want Cali to stay GitHub-agnostic, keep posting outside Cali and use the rendered output directly:

```bash
export GH_TOKEN="${GITHUB_TOKEN}"
gh pr comment "$PR_NUMBER" --body-file ./artifacts/combined-comment/ci-comment.md
```

## Config

Create `cali.config.ts` in the project root:

```ts
export default {
  defaultCommand: 'qa',
  workspaceRoot: '.',
  skillPaths: ['.agents/skills'],
  commands: {
    qa: {
      contextPath: './cali-context.json',
      mobileDefaults: {
        platform: 'android',
      },
      extraInstructions: ['Prioritize auth and onboarding flows.'],
    },
    review: {
      outputPublishers: ['file'],
    },
    perfReview: {
      extraInstructions: ['Focus on rerender hotspots first.'],
    },
  },
}
```

If `defaultCommand` is set, running plain `cali` with no command will execute that default command instead of showing help.

## Tool Packs

Built-in tool pack ids:

- `skills`
- `agent-device`
- `repo-read`
- `repo-write`
- `react-devtools`

Command defaults:

- `qa`: `skills`, `agent-device`
- `review`: `repo-read`, `skills` (experimental)
- `perf-review`: `skills`, `agent-device`, `react-devtools`, `repo-read` (experimental)
- `dev`: `repo-read`, `repo-write`, `skills` (experimental)

## Package Scripts

Built bundle:

- `bun run qa -- --help`
- `bun run review -- --help`
- `bun run perf-review -- --help`
- `bun run dev:command -- --help`
- `bun run qa:local:android -- --artifact ./artifacts/app.apk`
- `bun run qa:local:ios -- --artifact ./artifacts/MyApp.app`
- `bun run qa:ci:gha -- --platform android --artifact ./artifacts/app.apk`
- `bun run qa:ci:eas -- --platform ios --artifact ./artifacts/MyApp.app`
- `bun run review -- --context ./cali-context.json`
- `bun run perf-review -- --context ./cali-context.json --platform android --artifact ./artifacts/app.apk`
- `bun run dev:command -- --context ./cali-context.json`
- `bun run export-ci -- --report ./artifacts/qa/report.json`

Source/dev loop:

- `bun run dev:qa -- --help`
- `bun run dev:review -- --help`
- `bun run dev:perf-review -- --help`
- `bun run dev:dev-command -- --help`

## Outputs

The file publisher writes:

- `report.json`
- `section.md`
- `status.txt`
- `summary.txt`
- `top-issue.txt`
- `screenshots.md`
- `screenshots.json`
- `publisher-manifest.json`

The default output directory is `artifacts/<command>`.

For `qa`, Cali writes this output contract even for blocked runs during CI/bootstrap startup, as long as the output directory itself is writable.

`export-ci` writes a smaller shared CI contract:

- `ci-comment.md`
- `ci-output.json`

Single-platform `ci-output.json` combines:

- `kind`
- `status`
- `summary`
- `topIssue`
- `screenshots`

Multi-platform `ci-output.json` combines:

- `kind`
- `status`
- `summary`
- `topIssue`
- `platforms.android`
- `platforms.ios`

For `qa` and `perf-review`, screenshots are saved under `artifacts/<command>/screenshots`.

If `BLOB_READ_WRITE_TOKEN` is set, the blob publisher uploads screenshots and enriches the report with blob URLs.

## Repo Guide

For implementation details, runtime contracts, and guidance for extending Cali with new commands, see [`AGENTS.md`](../../AGENTS.md).
