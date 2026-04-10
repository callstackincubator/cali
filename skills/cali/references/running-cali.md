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

- `env` is the only preset concept
- all commands use one shared `cali-context.json`
- flags override context values

Built-in envs:

- `mobile-pr`
- `eas-mobile-pr`
- `local-android`
- `local-ios`

## Required local binaries

- `qa`: `agent-device`
- `perf-review`: `agent-device`, `agent-react-devtools`
- `review`: `git`, `rg`
- `dev`: `git`, `rg`, `zsh`

Do not auto-install missing CLIs. Cali should fail with actionable install guidance.

## Common commands

```bash
# Help
node packages/cali/dist/index.js --help
node packages/cali/dist/index.js qa --help

# Local iOS QA
node packages/cali/dist/index.js qa \
  --env local-ios \
  --artifact ./artifacts/MyApp.app \
  --prompt "verify onboarding copy on Screen B"

# Local Android QA
node packages/cali/dist/index.js qa \
  --env local-android \
  --artifact ./artifacts/app.apk \
  --prompt "verify onboarding copy on Screen B"

# CI-style QA
node packages/cali/dist/index.js qa \
  --ci github-actions \
  --platform ios \
  --artifact ./artifacts/MyApp.app

# EAS-style QA
node packages/cali/dist/index.js qa \
  --ci eas \
  --platform android \
  --artifact ./artifacts/app.apk

# Render a compact GitHub comment
node packages/cali/dist/index.js render-comment \
  --report ./artifacts/qa/report.json \
  --format github

# Export EAS helper files
node packages/cali/dist/index.js export-ci \
  --target eas \
  --report ./artifacts/qa/report.json
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

- For CI, prefer `cali qa --ci github-actions` or `cali qa --ci eas`.
- Cali derives runtime context from provider env plus CLI overrides before the agent starts.
- Use the explicit helper commands for integration glue:
  - `render-comment`
  - `export-ci`
  - `publish-comment`
- For copy-pasteable CI examples, use:
  - [`packages/cali/examples/github-actions/run-qa.sh`](../../../packages/cali/examples/github-actions/run-qa.sh)
  - [`packages/cali/examples/eas-workflows/run-qa.sh`](../../../packages/cali/examples/eas-workflows/run-qa.sh)
