---
name: cali
description: Use when working in the Cali repository or when you need to run, extend, or debug the Cali CLI for mobile React Native and Expo workflows. Covers Cali commands (`qa`, `review`, `perf-review`, `dev`), the shared `cali-context.json` contract, local mode selection, required local CLIs, provider setup, and CI integration patterns.
---

# Cali

Use this skill as a router with mandatory defaults. Read this file first. For normal Cali tasks, always load [references/running-cali.md](references/running-cali.md) before acting. If the task changes Cali itself, also load [references/extending-cali.md](references/extending-cali.md).

## Default operating rules

- Start with the shipped command surface and docs. Do not invent new Cali commands, envs, or config shapes.
- Treat `qa` as the stable command. Treat `review`, `perf-review`, and `dev` as experimental unless the task explicitly expands them.
- Prefer the shared `cali-context.json` contract over workflow-specific runtime scraping.
- Keep setup and CI instructions copy-pasteable when editing docs.
- If the task is about running Cali, verify the required local CLIs and model credentials before assuming the environment is ready.
- Required role skills are Cali-managed; local CLIs are not.
- If the task is about changing Cali, prefer small explicit runtime contracts over broad abstraction.

## Default flow

1. Load [references/running-cali.md](references/running-cali.md).
2. If the task changes implementation or runtime behavior, then load [references/extending-cali.md](references/extending-cali.md).
3. Confirm which command is actually in scope before changing code or docs.
4. Keep the task aligned to the current runtime model: command + local/CI mode + shared context + tool packs + publishers.

## Command surface

- `cali qa`
  - ship-ready mobile QA with `agent-device`
- `cali review`
  - experimental findings-first repository review
- `cali perf-review`
  - experimental runtime performance review with `agent-device` and `agent-react-devtools`
- `cali dev`
  - experimental repository-backed implementation flow

## Runtime modes

- local mobile: `--local android|ios`
- CI: implicit provider detection in GitHub Actions and EAS, with optional `--ci github-actions|eas` override

## Required references

- For every normal Cali task, after reading this file, load [references/running-cali.md](references/running-cali.md) first.
- If the task changes code, runtime behavior, or extension points, also load [references/extending-cali.md](references/extending-cali.md).
- Load additional repo files only after you identify the owning command, role, or runtime module.

## Additional references

- Public CLI, provider setup, required CLIs, and copy-pasteable CI examples: [`packages/cali/README.md`](../../packages/cali/README.md)
- Repo implementation guidance and validation expectations: [`AGENTS.md`](../../AGENTS.md)
