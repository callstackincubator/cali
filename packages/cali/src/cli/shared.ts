import { CaliPlatformSchema } from '../config/schema.js'
import type { CommandCliOptions } from '../runtime/types.js'
import { normalizePlatform } from '../utils.js'

export type BaseCommandOptions = {
  ci?: string
  local?: string
  config?: string
  prompt?: string
  context?: string
  outputDir?: string
  model?: string
  workspaceRoot?: string
  platform?: string
  artifact?: string
  appId?: string
  device?: string
  buildId?: string
  workflowUrl?: string
  logsUrl?: string
  prNumber?: string | number
  prTitle?: string
  prBody?: string
  prUrl?: string
  prBaseBranch?: string
  prHeadBranch?: string
  taskId?: string
  taskTitle?: string
  taskBody?: string
  taskUrl?: string
}

export function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function readOptionalNumber(value: unknown, flagName: string) {
  if (value == null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`\`${flagName}\` must be a valid number.`)
  }

  return parsed
}

export function normalizeBaseCommandCliOptions(options: BaseCommandOptions): CommandCliOptions {
  const platformValue = readOptionalString(options.platform)
  const platform = platformValue ? normalizePlatform(platformValue) : undefined
  const localValue = readOptionalString(options.local)
  const localResult = localValue ? CaliPlatformSchema.safeParse(localValue) : undefined
  const localPlatform = localResult?.success ? localResult.data : undefined
  const ciProvider = readOptionalString(options.ci) as CommandCliOptions['ciProvider']

  if (platformValue && !platform) {
    throw new Error('`--platform` must be `android` or `ios`.')
  }

  if (localValue && !localPlatform) {
    throw new Error('`--local` must be `android` or `ios`.')
  }

  if (ciProvider && ciProvider !== 'github-actions' && ciProvider !== 'eas') {
    throw new Error('`--ci` must be `github-actions` or `eas`.')
  }

  if (localPlatform && ciProvider) {
    throw new Error('Do not combine `--local` with `--ci`.')
  }

  return {
    ciProvider,
    localPlatform,
    configPath: readOptionalString(options.config),
    prompt: readOptionalString(options.prompt),
    contextPath: readOptionalString(options.context),
    outputDir: readOptionalString(options.outputDir),
    model: readOptionalString(options.model),
    workspaceRoot: readOptionalString(options.workspaceRoot),
    platform,
    artifactPath: readOptionalString(options.artifact),
    appId: readOptionalString(options.appId),
    deviceName: readOptionalString(options.device),
    buildId: readOptionalString(options.buildId),
    workflowUrl: readOptionalString(options.workflowUrl),
    logsUrl: readOptionalString(options.logsUrl),
    prNumber: readOptionalNumber(options.prNumber, '--pr-number'),
    prTitle: readOptionalString(options.prTitle),
    prBody: readOptionalString(options.prBody),
    prUrl: readOptionalString(options.prUrl),
    prBaseBranch: readOptionalString(options.prBaseBranch),
    prHeadBranch: readOptionalString(options.prHeadBranch),
    taskId: readOptionalString(options.taskId),
    taskTitle: readOptionalString(options.taskTitle),
    taskBody: readOptionalString(options.taskBody),
    taskUrl: readOptionalString(options.taskUrl),
  }
}

export function registerCommonCommandOptions(command: any) {
  return command
    .option('--ci <provider>', 'Override CI provider detection: github-actions or eas')
    .option('--config <path>', 'Path to cali.config.ts')
    .option('--prompt <text>', 'Add task-specific intent')
    .option('--context <path>', 'Load shared Cali runtime context from JSON')
    .option('--output-dir <path>', 'Output directory for artifacts')
    .option('--model <id>', 'Override the agent model')
    .option('--workspace-root <path>', 'Override the workspace root')
    .option('--pr-number <n>', 'Pull request number')
    .option('--pr-title <text>', 'Pull request title')
    .option('--pr-body <text>', 'Pull request body')
    .option('--pr-url <url>', 'Pull request URL')
    .option('--pr-base-branch <name>', 'Pull request base branch')
    .option('--pr-head-branch <name>', 'Pull request head branch')
    .option('--task-id <id>', 'Task identifier')
    .option('--task-title <text>', 'Task title')
    .option('--task-body <text>', 'Task body')
    .option('--task-url <url>', 'Task URL')
    .option('--build-id <id>', 'Build identifier')
    .option('--workflow-url <url>', 'Workflow or build link')
    .option('--logs-url <url>', 'Logs URL')
}

export function registerCommonMobileOptions(command: any, localDescription?: string) {
  return registerCommonCommandOptions(command)
    .option('--local <platform>', localDescription ?? 'Local mobile mode: android or ios')
    .option('--platform <name>', 'Override platform: android or ios')
    .option('--artifact <path>', 'App artifact path (.apk, .aab, .app, .ipa)')
    .option('--app-id <id>', 'Optional application identifier / package name override')
    .option('--device <name>', 'Simulator or emulator name to provision')
}
