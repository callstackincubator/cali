import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { resolveFromCwd } from '../utils.js'
import type { QaCliOptions, QaResolvedConfig, QaRuntimeContext } from './types.js'

const ContextMetadataSchema = z
  .object({
    prNumber: z.number().optional(),
    prTitle: z.string().optional(),
    prBody: z.string().nullable().optional(),
    prLabels: z.array(z.string()).optional(),
    isDraft: z.boolean().optional(),
    taskId: z.string().optional(),
    taskTitle: z.string().optional(),
    taskBody: z.string().optional(),
  })
  .optional()

const QaContextFileSchema = z.object({
  platform: z.enum(['android', 'ios']),
  artifactPath: z.string(),
  appId: z.string().optional(),
  buildId: z.string().optional(),
  workflowUrl: z.string().optional(),
  outputDir: z.string().optional(),
  deviceName: z.string().optional(),
  metadata: ContextMetadataSchema,
})

export async function fromContextFile(
  cwd: string,
  config: QaResolvedConfig,
  cli: QaCliOptions
): Promise<QaRuntimeContext> {
  const contextPath = cli.contextPath ?? config.contextPath

  if (!contextPath) {
    throw new Error('Context file mode requires --context or config.contextPath.')
  }

  const absolutePath = resolveFromCwd(cwd, contextPath)
  const content = await readFile(absolutePath, 'utf8')
  const parsed = QaContextFileSchema.parse(JSON.parse(content))
  const outputDir = resolveFromCwd(
    cwd,
    cli.outputDir ?? parsed.outputDir ?? config.outputDir ?? path.join('artifacts', 'qa')
  )
  const appId = cli.appId ?? config.appId ?? parsed.appId

  if (!appId) {
    throw new Error('Context file requires `appId` in the JSON file, config, or --app-id.')
  }

  return {
    platform: cli.platform ?? parsed.platform,
    artifactPath: resolveFromCwd(cwd, cli.artifactPath ?? parsed.artifactPath),
    appId,
    buildId: cli.buildId ?? parsed.buildId ?? 'context-build',
    workflowUrl: cli.workflowUrl ?? parsed.workflowUrl ?? '',
    outputDir,
    screenshotsDir: path.join(outputDir, 'screenshots'),
    deviceName: cli.deviceName ?? parsed.deviceName ?? config.platformDefaults.deviceName,
    metadata: {
      prNumber: cli.prNumber ?? parsed.metadata?.prNumber,
      prTitle: cli.prTitle ?? parsed.metadata?.prTitle,
      prBody: cli.prBody ?? parsed.metadata?.prBody,
      prLabels: parsed.metadata?.prLabels ?? [],
      isDraft: parsed.metadata?.isDraft ?? false,
      taskId: cli.taskId ?? parsed.metadata?.taskId,
      taskTitle: cli.taskTitle ?? parsed.metadata?.taskTitle,
      taskBody: cli.taskBody ?? parsed.metadata?.taskBody,
    },
  }
}
