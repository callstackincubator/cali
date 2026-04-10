import path from 'node:path'

import { resolveFromCwd } from '../utils.js'
import { loadContextFile } from './context-file.js'
import { detectRepositoryContext } from './context-repo.js'
import type {
  CaliContext,
  CommandCliOptions,
  CommandId,
  CommandResolvedConfig,
  PullRequestContext,
  TaskContext,
} from './types.js'

function isMobileCommand(commandId: CommandId) {
  return commandId === 'qa' || commandId === 'perf-review'
}

function normalizeTask(task?: Partial<TaskContext>): TaskContext | undefined {
  if (!task) {
    return undefined
  }

  return {
    ...task,
    labels: task.labels ?? [],
  }
}

function normalizePullRequest(
  pullRequest?: Partial<PullRequestContext>
): PullRequestContext | undefined {
  if (!pullRequest) {
    return undefined
  }

  return {
    ...pullRequest,
    labels: pullRequest.labels ?? [],
    isDraft: pullRequest.isDraft ?? false,
  }
}

function mergeContext(
  base: Partial<CaliContext>,
  override: Partial<CaliContext>
): Partial<CaliContext> {
  return {
    workspaceRoot: override.workspaceRoot ?? base.workspaceRoot,
    repository: {
      ...base.repository,
      ...override.repository,
    },
    task: normalizeTask(override.task ? { ...base.task, ...override.task } : base.task),
    pullRequest: normalizePullRequest(
      override.pullRequest ? { ...base.pullRequest, ...override.pullRequest } : base.pullRequest
    ),
    mobile: {
      ...base.mobile,
      ...override.mobile,
    },
    build: {
      ...base.build,
      ...override.build,
    },
    output: {
      ...base.output,
      ...override.output,
    },
    qa: override.qa ?? base.qa,
    perfReview: override.perfReview ?? base.perfReview,
    dev: override.dev ?? base.dev,
  }
}

function buildCliContext(cli: CommandCliOptions): Partial<CaliContext> {
  const context: Partial<CaliContext> = {}

  if (cli.workspaceRoot) {
    context.workspaceRoot = cli.workspaceRoot
  }

  if (cli.taskId || cli.taskTitle || cli.taskBody || cli.taskUrl) {
    context.task = {
      id: cli.taskId,
      title: cli.taskTitle,
      body: cli.taskBody,
      url: cli.taskUrl,
      labels: [],
    }
  }

  if (
    cli.prNumber ||
    cli.prTitle ||
    cli.prBody ||
    cli.prUrl ||
    cli.prBaseBranch ||
    cli.prHeadBranch
  ) {
    context.pullRequest = {
      number: cli.prNumber,
      title: cli.prTitle,
      body: cli.prBody,
      url: cli.prUrl,
      labels: [],
      isDraft: false,
      baseBranch: cli.prBaseBranch,
      headBranch: cli.prHeadBranch,
    }
  }

  if (cli.platform || cli.artifactPath || cli.appId || cli.deviceName) {
    context.mobile = {
      platform: cli.platform,
      artifactPath: cli.artifactPath,
      appId: cli.appId,
      deviceName: cli.deviceName,
    }
  }

  if (cli.buildId || cli.workflowUrl || cli.logsUrl) {
    context.build = {
      id: cli.buildId,
      workflowUrl: cli.workflowUrl,
      logsUrl: cli.logsUrl,
    }
  }

  return context
}

function resolveOutput(
  commandId: CommandId,
  workspaceRoot: string,
  cli: CommandCliOptions,
  context: Partial<CaliContext>
) {
  const outputDir = resolveFromCwd(
    workspaceRoot,
    cli.outputDir ?? context.output?.outputDir ?? path.join('artifacts', commandId)
  )

  return {
    outputDir,
    screenshotsDir:
      context.output?.screenshotsDir ??
      (isMobileCommand(commandId) ? path.join(outputDir, 'screenshots') : undefined),
  }
}

function applyDefaults(
  commandId: CommandId,
  context: Partial<CaliContext>,
  workspaceRoot: string,
  config: CommandResolvedConfig,
  cli: CommandCliOptions
): CaliContext {
  const output = resolveOutput(commandId, workspaceRoot, cli, context)

  return {
    workspaceRoot,
    repository: context.repository,
    task: normalizeTask(context.task),
    pullRequest: normalizePullRequest(context.pullRequest),
    mobile: isMobileCommand(commandId)
      ? {
          platform: context.mobile?.platform ?? config.mobileDefaults.platform,
          artifactPath: context.mobile?.artifactPath,
          appId: context.mobile?.appId ?? config.mobileDefaults.appId,
          deviceName: context.mobile?.deviceName ?? config.mobileDefaults.deviceName,
        }
      : context.mobile,
    build: context.build,
    output,
    qa:
      commandId === 'qa'
        ? {
            acceptanceCriteria: context.qa?.acceptanceCriteria ?? [],
          }
        : undefined,
    perfReview:
      commandId === 'perf-review'
        ? {
            profilingGoals: context.perfReview?.profilingGoals ?? [],
            suspectedScreens: context.perfReview?.suspectedScreens ?? [],
            targetFlow: context.perfReview?.targetFlow,
            expectedInteraction: context.perfReview?.expectedInteraction,
          }
        : undefined,
    dev:
      commandId === 'dev'
        ? {
            allowedValidations: context.dev?.allowedValidations ?? [],
            branchStrategy: context.dev?.branchStrategy,
            writePolicy: context.dev?.writePolicy ?? 'workspace',
            pushPolicy: context.dev?.pushPolicy ?? 'disabled',
          }
        : undefined,
  }
}

export async function resolveCommandContext(
  commandId: CommandId,
  cwd: string,
  config: CommandResolvedConfig,
  cli: CommandCliOptions,
  injectedContext: Partial<CaliContext> = {}
): Promise<CaliContext> {
  const fileContext = await loadContextFile(cwd, cli.contextPath ?? config.contextPath)
  const repositoryInfo = await detectRepositoryContext(cwd)
  const workspaceRoot =
    cli.workspaceRoot ??
    injectedContext.workspaceRoot ??
    fileContext.workspaceRoot ??
    config.workspaceRoot ??
    repositoryInfo.workspaceRoot

  const merged = mergeContext(
    {
      workspaceRoot,
      repository: repositoryInfo.repository,
      output: {},
    },
    mergeContext(mergeContext(fileContext, injectedContext), buildCliContext(cli))
  )

  return applyDefaults(commandId, merged, workspaceRoot, config, cli)
}
