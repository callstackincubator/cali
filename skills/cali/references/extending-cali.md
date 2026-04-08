# Extending Cali

Use this reference when changing the Cali CLI, runtime contracts, or docs.

## Start files

- CLI registry: [`packages/cali/src/cli/app.ts`](../../../packages/cali/src/cli/app.ts)
- Commands: `packages/cali/src/commands/*.ts`
- Roles: `packages/cali/src/roles/*.ts`
- Shared runtime:
  - [`packages/cali/src/runtime/context.ts`](../../../packages/cali/src/runtime/context.ts)
  - [`packages/cali/src/runtime/tool-packs.ts`](../../../packages/cali/src/runtime/tool-packs.ts)
  - [`packages/cali/src/runtime/tool-loop-role.ts`](../../../packages/cali/src/runtime/tool-loop-role.ts)
  - [`packages/cali/src/runtime/mobile.ts`](../../../packages/cali/src/runtime/mobile.ts)
- Config:
  - [`packages/cali/src/config/schema.ts`](../../../packages/cali/src/config/schema.ts)
  - [`packages/cali/src/config/load.ts`](../../../packages/cali/src/config/load.ts)
- Reports:
  - [`packages/cali/src/report/types.ts`](../../../packages/cali/src/report/types.ts)
  - [`packages/cali/src/report/render.ts`](../../../packages/cali/src/report/render.ts)

## Repo rules

- Prefer one shared context model over workflow-specific loaders.
- Keep command surfaces explicit. Avoid broad generic agent frameworks.
- Keep `qa` behavior reliable first.
- Keep setup and CI docs copy-pasteable.
- Do not commit generated `artifacts/`.

## Validation

For `packages/cali` changes:

```bash
bunx tsc --noEmit -p packages/cali/tsconfig.json
bun run build:cli
node packages/cali/dist/index.js --help
```

For CLI surface changes, also run the relevant command help checks.

For runtime changes, run at least one real command if the environment is available.
