import path from 'node:path'

import type { QaCliOptions, QaRuntimeContext } from './types.js'
import type { QaResolvedConfig } from './types.js'
import { normalizePlatform, parseJson, resolveFromCwd } from '../utils.js'

type ParsedPr = {
  number?: number
  title?: string
  body?: string | null
  draft?: boolean
  labels?: Array<{ name?: string }>
}

export async function fromEasEnv(
  cwd: string,
  config: QaResolvedConfig,
  cli: QaCliOptions
): Promise<QaRuntimeContext> {
  const parsedPr = parseJson<ParsedPr>(process.env.PR_JSON, {})
  const platform =
    cli.platform ??
    normalizePlatform(process.env.QA_PLATFORM) ??
    config.platformDefaults.platform

  if (!platform) {
    throw new Error('EAS adapter requires QA_PLATFORM or a preset platform default.')
  }

  const outputDir = resolveFromCwd(
    cwd,
    cli.outputDir ?? process.env.QA_OUTPUT_DIR ?? config.outputDir ?? path.join('artifacts', 'qa')
  )

  const artifactPath = cli.artifactPath ?? process.env.APP_PATH
  const appId = cli.appId ?? config.appId ?? process.env.APPLICATION_ID

  if (!artifactPath) {
    throw new Error('EAS adapter requires APP_PATH or --artifact.')
  }

  if (!appId) {
    throw new Error('EAS adapter requires APPLICATION_ID or --app-id.')
  }

  return {
    platform,
    artifactPath: resolveFromCwd(cwd, artifactPath),
    appId,
    buildId: cli.buildId ?? process.env.BUILD_ID ?? process.env.EAS_BUILD_ID ?? '',
    workflowUrl: cli.workflowUrl ?? process.env.WORKFLOW_URL ?? process.env.EAS_BUILD_URL ?? '',
    outputDir,
    screenshotsDir: path.join(outputDir, 'screenshots'),
    deviceName:
      cli.deviceName ??
      process.env.DEVICE_NAME ??
      (platform === 'ios'
        ? process.env.AGENT_DEVICE_IOS_DEVICE
        : process.env.AGENT_DEVICE_ANDROID_DEVICE),
    metadata: {
      prNumber: cli.prNumber ?? parsedPr.number,
      prTitle: cli.prTitle ?? parsedPr.title,
      prBody: cli.prBody ?? parsedPr.body,
      prLabels: Array.isArray(parsedPr.labels)
        ? parsedPr.labels.map((label) => label.name).filter((value): value is string => Boolean(value))
        : [],
      isDraft: Boolean(parsedPr.draft),
      taskId: cli.taskId ?? process.env.TASK_ID,
      taskTitle: cli.taskTitle,
      taskBody: cli.taskBody,
    },
  }
}
