import { cac } from 'cac'

import { runQaCommand } from '../commands/qa.js'
import type { QaCliOptions } from '../env/types.js'
import { normalizePlatform } from '../utils.js'

type QaCommandOptions = {
  preset?: string
  config?: string
  prompt?: string
  json?: string
  platform?: string
  artifact?: string
  appId?: string
  device?: string
  outputDir?: string
  buildId?: string
  workflowUrl?: string
  prNumber?: string | number
  prTitle?: string
  prBody?: string
  taskId?: string
  taskTitle?: string
  taskBody?: string
  model?: string
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function readOptionalNumber(value: unknown, flagName: string) {
  if (value == null || value === '') {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`\`${flagName}\` must be a valid number.`)
  }

  return parsed
}

function normalizeQaCliOptions(options: QaCommandOptions): QaCliOptions {
  const platformValue = readOptionalString(options.platform)
  const platform = platformValue ? normalizePlatform(platformValue) : undefined

  if (platformValue && !platform) {
    throw new Error('`--platform` must be `android` or `ios`.')
  }

  return {
    presetName: readOptionalString(options.preset) as QaCliOptions['presetName'],
    configPath: readOptionalString(options.config),
    prompt: readOptionalString(options.prompt),
    jsonPath: readOptionalString(options.json),
    platform,
    artifactPath: readOptionalString(options.artifact),
    appId: readOptionalString(options.appId),
    deviceName: readOptionalString(options.device),
    outputDir: readOptionalString(options.outputDir),
    buildId: readOptionalString(options.buildId),
    workflowUrl: readOptionalString(options.workflowUrl),
    prNumber: readOptionalNumber(options.prNumber, '--pr-number'),
    prTitle: readOptionalString(options.prTitle),
    prBody: readOptionalString(options.prBody),
    taskId: readOptionalString(options.taskId),
    taskTitle: readOptionalString(options.taskTitle),
    taskBody: readOptionalString(options.taskBody),
    model: readOptionalString(options.model),
  }
}

export function registerQaCommand(cli: ReturnType<typeof cac>, printBanner: () => void) {
  cli
    .command('qa', 'Run the mobile QA role')
    .option(
      '--preset <name>',
      'Built-in preset: eas-mobile-pr, github-actions-pr, local-android, local-ios'
    )
    .option('--config <path>', 'Path to cali.config.ts')
    .option('--prompt <text>', 'Add task-specific QA intent')
    .option('--json <path>', 'Load normalized environment context from JSON')
    .option('--platform <name>', 'android or ios')
    .option('--artifact <path>', 'App artifact path (.apk, .aab, .app, .ipa)')
    .option('--app-id <id>', 'Application identifier / package name')
    .option('--device <name>', 'Simulator or emulator name to provision')
    .option('--output-dir <path>', 'Output directory for artifacts')
    .option('--build-id <id>', 'Build identifier')
    .option('--workflow-url <url>', 'Workflow or build link')
    .option('--pr-number <n>', 'Pull request number')
    .option('--pr-title <text>', 'Pull request title')
    .option('--pr-body <text>', 'Pull request body')
    .option('--task-id <id>', 'Task identifier')
    .option('--task-title <text>', 'Task title')
    .option('--task-body <text>', 'Task body')
    .option('--model <id>', 'Override the QA model')
    .example(
      'qa --preset local-ios --artifact ./artifacts/MyApp.app --app-id com.example.myapp --prompt "verify the onboarding copy on Screen B"'
    )
    .action(async (options) => {
      printBanner()
      await runQaCommand(normalizeQaCliOptions(options as QaCommandOptions))
    })
}
