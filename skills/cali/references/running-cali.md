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
  --env mobile-pr \
  --context ./cali-context.json

# Generate CI context
node packages/cali/dist/index.js write-mobile-pr-context \
  --from eas \
  --output ./cali-context.json

# Render a compact GitHub comment
node packages/cali/dist/index.js render-comment \
  --report ./artifacts/qa/report.json \
  --format github
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

- Generate `cali-context.json` before invoking Cali.
- Do not assume Cali will scrape PR/build metadata from the environment at runtime.
- Prefer the built-in `write-mobile-pr-context` command over custom `jq` wrappers.
- For copy-pasteable CI examples, use:
  - [`packages/cali/examples/github-actions/write-mobile-pr-context.sh`](../../../packages/cali/examples/github-actions/write-mobile-pr-context.sh)
  - [`packages/cali/examples/eas-workflows/write-mobile-pr-context.sh`](../../../packages/cali/examples/eas-workflows/write-mobile-pr-context.sh)
