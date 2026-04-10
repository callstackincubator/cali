import { readFile } from 'node:fs/promises'

import { DOCS_URLS } from '../docs.js'
import { detectRepositoryContext, sanitizeUrl } from './context-repo.js'
import type { CaliContext, CaliPlatform } from './types.js'

export type CiProvider = 'github-actions' | 'eas'

type BuildCiContextOptions = {
  platform?: CaliPlatform
  artifactPath?: string
  appId?: string
  deviceName?: string
  outputDir?: string
  workspaceRoot?: string
  buildId?: string
  workflowUrl?: string
  logsUrl?: string
}

function readOptionalEnv(name: string) {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

function normalizePlatform(value: string | undefined): CaliPlatform | undefined {
  return value === 'android' || value === 'ios' ? value : undefined
}

function createCiContextError(message: string) {
  return new Error([message, `Docs: ${DOCS_URLS.ciProviders}`].join('\n\n'))
}

async function loadJsonFile(filePath: string) {
  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content)
}

function normalizePullRequest(pullRequest: any): CaliContext['pullRequest'] {
  if (!pullRequest) {
    return undefined
  }

  return {
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body,
    url: sanitizeUrl(pullRequest.html_url, { stripQuery: true }),
    labels: (pullRequest.labels ?? []).map((label: any) => label.name).filter(Boolean),
    isDraft: pullRequest.draft ?? false,
    baseBranch: pullRequest.base?.ref,
    headBranch: pullRequest.head?.ref,
  }
}

function resolveGithubRepositoryContext(): CaliContext['repository'] {
  const repositoryName = readOptionalEnv('GITHUB_REPOSITORY')
  const currentBranch = readOptionalEnv('GITHUB_REF_NAME')
  const commitSha = readOptionalEnv('GITHUB_SHA')
  const serverUrl = readOptionalEnv('GITHUB_SERVER_URL')

  if (!repositoryName) {
    return undefined
  }

  const [owner, name] = repositoryName.split('/')
  return {
    provider: 'github.com',
    owner,
    name,
    webUrl:
      serverUrl && owner && name
        ? sanitizeUrl(`${serverUrl}/${owner}/${name}`, { stripQuery: true })
        : undefined,
    currentBranch,
    commitSha,
  }
}

function readPullRequestJson(rawPrJson: string | undefined) {
  if (!rawPrJson) {
    return undefined
  }

  try {
    return JSON.parse(rawPrJson)
  } catch {
    throw createCiContextError('Failed to parse PR_JSON as JSON.')
  }
}

function createCommonContext(options: {
  workspaceRoot: string
  repository?: CaliContext['repository']
  pullRequest?: CaliContext['pullRequest']
  platform: CaliPlatform
  artifactPath: string
  appId?: string
  deviceName?: string
  outputDir: string
  buildId?: string
  workflowUrl?: string
  logsUrl?: string
}): Partial<CaliContext> {
  return {
    workspaceRoot: options.workspaceRoot,
    repository: options.repository,
    pullRequest: options.pullRequest,
    mobile: {
      platform: options.platform,
      artifactPath: options.artifactPath,
      appId: options.appId,
      deviceName: options.deviceName,
    },
    build:
      options.buildId || options.workflowUrl || options.logsUrl
        ? {
            id: options.buildId,
            workflowUrl: sanitizeUrl(options.workflowUrl, { stripQuery: true }),
            logsUrl: sanitizeUrl(options.logsUrl, { stripQuery: true }),
          }
        : undefined,
    output: {
      outputDir: options.outputDir,
    },
  }
}

async function buildGithubActionsContext(
  cwd: string,
  options: BuildCiContextOptions
): Promise<Partial<CaliContext>> {
  const eventPath = readOptionalEnv('GITHUB_EVENT_PATH')
  if (!eventPath) {
    throw createCiContextError('GitHub Actions CI mode requires GITHUB_EVENT_PATH.')
  }

  const event = await loadJsonFile(eventPath)
  const detectedRepository = await detectRepositoryContext(cwd)
  const githubRepository = resolveGithubRepositoryContext()
  const outputDir = options.outputDir ?? readOptionalEnv('CALI_OUTPUT_DIR') ?? './artifacts/qa'
  const buildId = options.buildId ?? readOptionalEnv('GITHUB_RUN_ID')
  const platform = options.platform ?? normalizePlatform(readOptionalEnv('CALI_PLATFORM'))
  const artifactPath = options.artifactPath ?? readOptionalEnv('CALI_ARTIFACT_PATH')
  const serverUrl = readOptionalEnv('GITHUB_SERVER_URL')
  const repositoryName = readOptionalEnv('GITHUB_REPOSITORY')
  const workflowUrl =
    options.workflowUrl ??
    (serverUrl && repositoryName && buildId
      ? `${serverUrl}/${repositoryName}/actions/runs/${buildId}`
      : undefined)

  if (!platform) {
    throw createCiContextError('GitHub Actions CI mode requires CALI_PLATFORM or --platform.')
  }

  if (!artifactPath) {
    throw createCiContextError('GitHub Actions CI mode requires CALI_ARTIFACT_PATH or --artifact.')
  }

  return createCommonContext({
    workspaceRoot: options.workspaceRoot ?? readOptionalEnv('GITHUB_WORKSPACE') ?? cwd,
    repository: {
      ...detectedRepository.repository,
      ...githubRepository,
    },
    pullRequest: normalizePullRequest(event?.pull_request),
    platform,
    artifactPath,
    appId: options.appId ?? readOptionalEnv('CALI_APP_ID'),
    deviceName: options.deviceName ?? readOptionalEnv('CALI_DEVICE_NAME'),
    outputDir,
    buildId,
    workflowUrl,
    logsUrl: options.logsUrl,
  })
}

async function buildEasContext(
  cwd: string,
  options: BuildCiContextOptions
): Promise<Partial<CaliContext>> {
  const detectedRepository = await detectRepositoryContext(cwd)
  const githubRepository = resolveGithubRepositoryContext()
  const outputDir = options.outputDir ?? readOptionalEnv('CALI_OUTPUT_DIR') ?? './artifacts/qa'
  const artifactPath = options.artifactPath ?? readOptionalEnv('APP_PATH')
  const platform = options.platform ?? normalizePlatform(readOptionalEnv('QA_PLATFORM'))

  if (!artifactPath) {
    throw createCiContextError('EAS CI mode requires APP_PATH or --artifact.')
  }

  if (!platform) {
    throw createCiContextError('EAS CI mode requires QA_PLATFORM or --platform.')
  }

  return createCommonContext({
    workspaceRoot: options.workspaceRoot ?? cwd,
    repository: {
      ...detectedRepository.repository,
      ...githubRepository,
    },
    pullRequest: normalizePullRequest(readPullRequestJson(readOptionalEnv('PR_JSON'))),
    platform,
    artifactPath,
    appId: options.appId ?? readOptionalEnv('APPLICATION_ID'),
    deviceName: options.deviceName ?? readOptionalEnv('CALI_DEVICE_NAME'),
    outputDir,
    buildId: options.buildId ?? readOptionalEnv('BUILD_ID'),
    workflowUrl: options.workflowUrl ?? readOptionalEnv('WORKFLOW_URL'),
    logsUrl: options.logsUrl ?? readOptionalEnv('LOGS_URL'),
  })
}

export async function buildCiContext(
  cwd: string,
  provider: CiProvider,
  options: BuildCiContextOptions
): Promise<Partial<CaliContext>> {
  if (provider === 'github-actions') {
    return buildGithubActionsContext(cwd, options)
  }

  return buildEasContext(cwd, options)
}
