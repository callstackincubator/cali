# cali

Cali v2 is a role-oriented CLI for mobile React Native and Expo workflows. It runs first-class agent commands on top of a shared runtime model:

- commands: `qa`, `review`, `perf-review`, `dev`
- envs: `mobile-pr`, `local-android`, `local-ios`
- one shared `cali-context.json` runtime contract
- explicit tool packs per command
- publisher-based outputs
- additive `--prompt`

## Core Concepts

- command: the user-facing role entrypoint such as `cali qa` or `cali review`
- env: default runtime shape for a command, such as CI-style `mobile-pr` or local mobile envs
- context file: the explicit JSON input for workspace, repository, PR/task, mobile, build, output, and role-specific sections
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

## Examples

### Local QA

```bash
cali qa \
  --env local-ios \
  --artifact ./artifacts/MyApp.app \
  --prompt "verify the onboarding copy on Screen B"
```

Local mobile behavior:

- each run gets a unique `agent-device` session name such as `ios-a1b2c`
- local Android reuses the single booted emulator/device when exactly one is available, otherwise pass `--device`
- local envs try `open --relaunch` before reinstalling
- `local-ios` reuses the single booted simulator when exactly one is available, otherwise pass `--device`

### CI-style QA or review

```bash
cali qa --env mobile-pr --context ./cali-context.json
cali review --env mobile-pr --context ./cali-context.json
```

Use `--quiet` to suppress the retro banner in scripted environments. Cali also suppresses the banner automatically when `CI=true`.

### Runtime performance review

```bash
cali perf-review \
  --env mobile-pr \
  --context ./cali-context.json \
  --prompt "profile the checkout flow"
```

### Repo-backed implementation

```bash
cali dev --env mobile-pr --context ./cali-context.json --prompt "implement issue 123"
```

## Provider Setup

Cali supports two model auth paths:

### AI Gateway

```bash
export AI_GATEWAY_API_KEY="your-ai-gateway-key"
export QA_MODEL="openai/gpt-5.4-mini"
```

Gateway also accepts the compatibility alias:

```bash
export AI_GATEWAY_KEY="your-ai-gateway-key"
```

### Anthropic Direct

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
export QA_MODEL="anthropic/claude-sonnet-4.6"
```

Anthropic also accepts the compatibility alias:

```bash
export CLAUDE_API_KEY="your-anthropic-api-key"
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

## CI Providers

The current ship-ready CI story for Cali is:

- generate one `cali-context.json`
- run `cali qa --env mobile-pr --context ./cali-context.json`
- collect `artifacts/qa/report.json`, `section.md`, `status.txt`, and optional blob screenshot URLs

### GitHub Actions

Use the example context writer:

- [`examples/github-actions/write-mobile-pr-context.sh`](./examples/github-actions/write-mobile-pr-context.sh)

Required envs for that script:

- `CALI_PLATFORM`
- `CALI_ARTIFACT_PATH`
- optional `CALI_APP_ID`
- optional `CALI_DEVICE_NAME`

Copy-paste example:

```yaml
- name: Install Cali CLIs
  run: npm i -g agent-device

- name: Write Cali context
  env:
    CALI_PLATFORM: android
    CALI_ARTIFACT_PATH: ${{ steps.download_build.outputs.artifact_path }}
    CALI_APP_ID: com.example.myapp
  run: bash ./packages/cali/examples/github-actions/write-mobile-pr-context.sh ./cali-context.json

- name: Run Cali QA
  env:
    AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
  run: node ./packages/cali/dist/index.js qa --env mobile-pr --context ./cali-context.json
```

### EAS Workflows

Use the example context writer:

- [`examples/eas-workflows/write-mobile-pr-context.sh`](./examples/eas-workflows/write-mobile-pr-context.sh)

This matches the environment shape from the earlier `eas-agent-device` workflow pattern:

- `QA_PLATFORM`
- `APP_PATH`
- `APPLICATION_ID`
- optional `BUILD_ID`
- optional `WORKFLOW_URL`
- optional `PR_JSON`

Copy-paste example:

```yaml
- id: install_agent_device
  run: npm i -g agent-device

- id: write_cali_context
  env:
    QA_PLATFORM: android
    APP_PATH: ${{ steps.download_build.outputs.artifact_path }}
    APPLICATION_ID: dev.expo.myapp
    BUILD_ID: ${{ env.BUILD_ID }}
    WORKFLOW_URL: ${{ workflow.url }}
    PR_JSON: ${{ toJSON(github.event.pull_request) }}
  run: bash ./packages/cali/examples/eas-workflows/write-mobile-pr-context.sh ./cali-context.json

- id: run_cali_qa
  env:
    AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
  run: node ./packages/cali/dist/index.js qa --env mobile-pr --context ./cali-context.json
```

If you want a combined PR comment like the original Expo blog post flow, aggregate `section.md`, `status.txt`, and `report.json` from each platform job in a final workflow step. Cali intentionally leaves that aggregation to the workflow layer.

## Config

Create `cali.config.ts` in the project root:

```ts
export default {
  defaultCommand: 'qa',
  env: 'mobile-pr',
  workspaceRoot: '.',
  skillPaths: ['.agents/skills'],
  commands: {
    qa: {
      contextPath: './cali-context.json',
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

By default, Cali discovers skills from:

- `./.agents/skills`
- `~/.agents/skills`

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
- `bun run qa:env:mobile-pr -- --context ./cali-context.json`
- `bun run review:env:mobile-pr -- --context ./cali-context.json`
- `bun run perf-review:env:mobile-pr -- --context ./cali-context.json`
- `bun run dev:command:env:mobile-pr -- --context ./cali-context.json`

Source/dev loop:

- `bun run dev:qa -- --help`
- `bun run dev:review -- --help`
- `bun run dev:perf-review -- --help`
- `bun run dev:dev-command -- --help`

## Installing Skills

For starter skills, use `npx skills` with the repos we trust:

```bash
npx skills add callstackincubator/agent-device --agent codex --skill '*' -y
npx skills add callstackincubator/agent-skills --agent codex --skill '*' -y
```

If you want to use performance review flows, make sure the relevant skills are installed too, such as `react-devtools`.

## Outputs

The file publisher writes:

- `report.json`
- `section.md`
- `status.txt`
- `publisher-manifest.json`

The default output directory is `artifacts/<command>`.

For `qa` and `perf-review`, screenshots are saved under `artifacts/<command>/screenshots`.

If `BLOB_READ_WRITE_TOKEN` is set, the blob publisher uploads screenshots and enriches the report with blob URLs.

## Repo Guide

For implementation details, runtime contracts, and guidance for extending Cali with new commands, see [`AGENTS.md`](../../AGENTS.md).
