# cali

Cali v2 is a QA-oriented CLI for mobile app review runs. The first shipped role is `cali qa`, which splits deterministic bootstrap from the agent phase and standardizes the resulting QA report.

## Current scope

- `cali qa`
- presets: `eas-mobile-pr`, `local-android`, `local-ios`
- environment adapters: EAS env, local flags, JSON context
- tool packs: `skills`, `agent-device`
- publishers: `blob`, `file`
- additive `--prompt`

## Example

```bash
cali qa \
  --preset local-ios \
  --artifact ./artifacts/MyApp.app \
  --app-id com.example.myapp \
  --device "iPhone 16" \
  --prompt "verify the onboarding copy on Screen B"
```

## Credentials

`cali qa` supports two model auth paths:

- AI Gateway: `AI_GATEWAY_API_KEY`
- AI Gateway alias: `AI_GATEWAY_KEY`
- Anthropic direct: `ANTHROPIC_API_KEY`
- Anthropic alias: `CLAUDE_API_KEY`

Cali defaults to `anthropic/claude-sonnet-4.6`.
If gateway credentials are present, that model is routed through AI Gateway.
Direct provider support in this package is Anthropic only.

## Config

Create `cali.config.ts` in the project root:

```ts
export default {
  role: 'qa',
  preset: 'local-android',
  skillPaths: ['./.cali/skills'],
  extraInstructions: [
    'Prioritize auth and onboarding flows.',
  ],
}
```

## Outputs

By default the file publisher writes:

- `artifacts/qa/report.json`
- `artifacts/qa/section.md`
- `artifacts/qa/status.txt`

If `BLOB_READ_WRITE_TOKEN` is set, the blob publisher uploads screenshots and enriches the JSON report with blob URLs.
