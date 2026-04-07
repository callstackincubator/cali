import path from 'node:path'

import { resolveFromCwd } from '../utils.js'
import type { QaCliOptions, QaRuntimeContext } from './types.js'
import type { QaResolvedConfig } from './types.js'

export async function fromLocalFlags(
  cwd: string,
  config: QaResolvedConfig,
  cli: QaCliOptions
): Promise<QaRuntimeContext> {
  const platform = cli.platform ?? config.platformDefaults.platform
  const artifactPath = cli.artifactPath
  const appId = cli.appId ?? config.appId

  if (!platform) {
    throw new Error('Local env requires --platform or an env default platform.')
  }

  if (!artifactPath) {
    throw new Error('Local env requires --artifact unless you provide a context file.')
  }

  if (!appId) {
    throw new Error('Local env requires --app-id or config.appId.')
  }

  const outputDir = resolveFromCwd(
    cwd,
    cli.outputDir ?? config.outputDir ?? path.join('artifacts', 'qa')
  )

  return {
    platform,
    artifactPath: resolveFromCwd(cwd, artifactPath),
    appId,
    buildId: cli.buildId ?? 'local-build',
    workflowUrl: cli.workflowUrl ?? '',
    outputDir,
    screenshotsDir: path.join(outputDir, 'screenshots'),
    deviceName: cli.deviceName ?? config.platformDefaults.deviceName,
    metadata: {
      prNumber: cli.prNumber,
      prTitle: cli.prTitle,
      prBody: cli.prBody,
      prLabels: [],
      isDraft: false,
      taskId: cli.taskId,
      taskTitle: cli.taskTitle,
      taskBody: cli.taskBody,
    },
  }
}
