import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { normalizePlatform, resolveFromCwd } from '../utils.js'
import type { QaCliOptions, QaRuntimeContext, QaResolvedConfig } from './types.js'

type GitHubLabel = {
  name?: string
}

type GitHubPullRequest = {
  number?: number
  title?: string
  body?: string | null
  draft?: boolean
  labels?: GitHubLabel[]
}

type GitHubIssue = {
  number?: number
  title?: string
  body?: string | null
  labels?: GitHubLabel[]
}

type GitHubEventPayload = {
  pull_request?: GitHubPullRequest
  issue?: GitHubIssue
}

async function readGitHubEventPayload(): Promise<GitHubEventPayload> {
  const eventPath = process.env.GITHUB_EVENT_PATH

  if (!eventPath) {
    return {}
  }

  const content = await readFile(eventPath, 'utf8')
  return JSON.parse(content) as GitHubEventPayload
}

function createWorkflowUrl() {
  const serverUrl = process.env.GITHUB_SERVER_URL
  const repository = process.env.GITHUB_REPOSITORY
  const runId = process.env.GITHUB_RUN_ID

  if (!serverUrl || !repository || !runId) {
    return ''
  }

  return `${serverUrl}/${repository}/actions/runs/${runId}`
}

function readLabelNames(labels: GitHubLabel[] | undefined) {
  return Array.isArray(labels)
    ? labels.map((label) => label.name).filter((value): value is string => Boolean(value))
    : []
}

export async function fromGitHubActionsEnv(
  cwd: string,
  config: QaResolvedConfig,
  cli: QaCliOptions
): Promise<QaRuntimeContext> {
  const event = await readGitHubEventPayload()
  const pullRequest = event.pull_request
  const issue = event.issue
  const platform =
    cli.platform ?? normalizePlatform(process.env.QA_PLATFORM) ?? config.platformDefaults.platform

  if (!platform) {
    throw new Error('GitHub Actions adapter requires QA_PLATFORM or a preset platform default.')
  }

  const outputDir = resolveFromCwd(
    cwd,
    cli.outputDir ?? process.env.QA_OUTPUT_DIR ?? config.outputDir ?? path.join('artifacts', 'qa')
  )
  const artifactPath = cli.artifactPath ?? process.env.APP_PATH ?? process.env.QA_ARTIFACT_PATH
  const appId = cli.appId ?? config.appId ?? process.env.APPLICATION_ID

  if (!artifactPath) {
    throw new Error('GitHub Actions adapter requires APP_PATH, QA_ARTIFACT_PATH, or --artifact.')
  }

  if (!appId) {
    throw new Error('GitHub Actions adapter requires APPLICATION_ID or --app-id.')
  }

  return {
    platform,
    artifactPath: resolveFromCwd(cwd, artifactPath),
    appId,
    buildId:
      cli.buildId ??
      process.env.BUILD_ID ??
      process.env.GITHUB_RUN_ID ??
      process.env.GITHUB_SHA ??
      'github-actions-run',
    workflowUrl: cli.workflowUrl ?? createWorkflowUrl(),
    outputDir,
    screenshotsDir: path.join(outputDir, 'screenshots'),
    deviceName:
      cli.deviceName ??
      process.env.DEVICE_NAME ??
      (platform === 'ios'
        ? process.env.AGENT_DEVICE_IOS_DEVICE
        : process.env.AGENT_DEVICE_ANDROID_DEVICE),
    metadata: {
      prNumber: cli.prNumber ?? pullRequest?.number ?? issue?.number,
      prTitle: cli.prTitle ?? pullRequest?.title ?? issue?.title,
      prBody: cli.prBody ?? pullRequest?.body ?? issue?.body,
      prLabels: readLabelNames(pullRequest?.labels ?? issue?.labels),
      isDraft: Boolean(pullRequest?.draft),
      taskId: cli.taskId ?? process.env.GITHUB_REF_NAME,
      taskTitle: cli.taskTitle,
      taskBody: cli.taskBody,
    },
  }
}
