# Running Cali

Use this reference for normal Cali usage, setup, and CI wiring.

## Public commands

- `cali qa`
  - ship-ready mobile QA with `agent-device`
- `cali review`
  - experimental findings-first repository review
- `cali perf-review`
  - experimental runtime performance review with `agent-device` and `agent-react-devtools`
- `cali dev`
  - experimental repository-backed implementation flow

## Runtime model

- local mobile runs use `--local android|ios`
- CI runs use implicit provider detection in GitHub Actions and EAS
- all commands use one shared `cali-context.json`
- flags override context values

Use `--ci github-actions|eas` only when you need to override provider detection.

## Required local binaries

- `qa`: `agent-device`
- `perf-review`: `agent-device`, `agent-react-devtools`
- `review`: `git`, `rg`
- `dev`: `git`, `rg`, `zsh`

Do not auto-install missing CLIs. Cali should fail with actionable install guidance.

## Required skills

- Cali auto-installs missing required skills with `npx skills`
- install target order:
  - `~/.cali/skills`
  - `./.cali/skills`
- additional optional skills can still be discovered from:
  - `./.agents/skills`
  - `~/.agents/skills`

## Common commands

```bash
# Help
node packages/cali/dist/index.js --help
node packages/cali/dist/index.js qa --help

# Local iOS QA
node packages/cali/dist/index.js qa \
  --local ios \
  --artifact ./artifacts/MyApp.app \
  --prompt "verify onboarding copy on Screen B"

# Local Android QA
node packages/cali/dist/index.js qa \
  --local android \
  --artifact ./artifacts/app.apk \
  --prompt "verify onboarding copy on Screen B"

# CI-style QA
node packages/cali/dist/index.js qa \
  --platform ios \
  --artifact ./artifacts/MyApp.app

# EAS-style QA
node packages/cali/dist/index.js qa \
  --platform android \
  --artifact ./artifacts/app.apk

# CI-style review
node packages/cali/dist/index.js review \
  --context ./cali-context.json

# CI-style performance review
node packages/cali/dist/index.js perf-review \
  --context ./cali-context.json \
  --platform android \
  --artifact ./artifacts/app.apk

# CI-style dev command
node packages/cali/dist/index.js dev \
  --context ./cali-context.json \
  --prompt "implement issue 123"

# Export CI helper files from one report
node packages/cali/dist/index.js export-ci \
  --report ./artifacts/qa/report.json

# Export one combined CI comment from two platform reports
node packages/cali/dist/index.js export-ci \
  --android ./artifacts/android/report.json \
  --ios ./artifacts/ios/report.json
```

## Provider setup

Gateway:

```dotenv
AI_GATEWAY_API_KEY=your-ai-gateway-key
QA_MODEL=openai/gpt-5.4-mini
```

Anthropic direct:

```dotenv
ANTHROPIC_API_KEY=your-anthropic-api-key
QA_MODEL=anthropic/claude-sonnet-4.6
```

`packages/cali` loads `.env` automatically from the current workspace before a run.

## CI notes

- In GitHub Actions and EAS, Cali detects the provider automatically.
- Use `--ci github-actions|eas` only to override provider detection.
- Cali derives runtime context from provider env plus CLI overrides before the agent starts.
- Use the explicit helper commands for integration glue:
  - `export-ci`
- For copy-pasteable CI examples, use:
  - [`packages/cali/examples/github-actions/run-qa.sh`](../../../packages/cali/examples/github-actions/run-qa.sh)
  - [`packages/cali/examples/eas-workflows/run-qa.sh`](../../../packages/cali/examples/eas-workflows/run-qa.sh)
