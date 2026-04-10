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

For `qa`, use:
- `--env local-android` or `--env local-ios` for local runs
- `--ci github-actions` or `--ci eas` for CI runs

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

- For CI, prefer `cali qa --ci github-actions` or `cali qa --ci eas`.
- `cali qa --env mobile-pr` and `cali qa --env eas-mobile-pr` are intentionally not supported.
- Cali derives runtime context from provider env plus CLI overrides before the agent starts.
- Use the explicit helper commands for integration glue:
  - `export-ci`
- For copy-pasteable CI examples, use:
  - [`packages/cali/examples/github-actions/run-qa.sh`](../../../packages/cali/examples/github-actions/run-qa.sh)
  - [`packages/cali/examples/eas-workflows/run-qa.sh`](../../../packages/cali/examples/eas-workflows/run-qa.sh)
