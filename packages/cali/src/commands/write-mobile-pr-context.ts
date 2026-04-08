import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DOCS_URLS } from '../docs.js'
import { detectRepositoryContext, sanitizeUrl } from '../runtime/context-repo.js'
import type { CaliContext } from '../runtime/types.js'
import { ensureDirectory, resolveFromCwd } from '../utils.js'

type WriteMobilePrContextProvider = 'github-actions' | 'eas'
type MobilePlatform = 'android' | 'ios'

export type WriteMobilePrContextOptions = {
  from: WriteMobilePrContextProvider
  outputPath: string
  platform?: MobilePlatform
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

function normalizePlatform(value: string | undefined): MobilePlatform | undefined {
  return value === 'android' || value === 'ios' ? value : undefined
}

function createContextWriterError(message: string) {
  return new Error([message, `Docs: ${DOCS_URLS.ciHelpers}`].join('\n\n'))
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
    throw createContextWriterError('Failed to parse PR_JSON as JSON.')
  }
}

function createCommonContext(options: {
  workspaceRoot: string
  repository?: CaliContext['repository']
  pullRequest?: CaliContext['pullRequest']
  platform: MobilePlatform
  artifactPath: string
  appId?: string
  deviceName?: string
  outputDir: string
  buildId?: string
  workflowUrl?: string
  logsUrl?: string
}): CaliContext {
  return {
    workspaceRoot: options.workspaceRoot,
    repository: options.repository,
    task: undefined,
    pullRequest: options.pullRequest,
    mobile: {
      platform: options.platform,
      artifactPath: options.artifactPath,
      appId: options.appId,
      deviceName: options.deviceName,
    },
    build: {
      id: options.buildId,
      workflowUrl: sanitizeUrl(options.workflowUrl, { stripQuery: true }),
      logsUrl: sanitizeUrl(options.logsUrl, { stripQuery: true }),
    },
    output: {
      outputDir: options.outputDir,
    },
  }
}

async function buildGithubActionsContext(
  cwd: string,
  options: WriteMobilePrContextOptions
): Promise<CaliContext> {
  const eventPath = readOptionalEnv('GITHUB_EVENT_PATH')
  if (!eventPath) {
    throw createContextWriterError('GitHub Actions context generation requires GITHUB_EVENT_PATH.')
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
    throw createContextWriterError(
      'GitHub Actions context generation requires CALI_PLATFORM or --platform.'
    )
  }

  if (!artifactPath) {
    throw createContextWriterError(
      'GitHub Actions context generation requires CALI_ARTIFACT_PATH or --artifact.'
    )
  }

  return createCommonContext({
    workspaceRoot: resolveFromCwd(
      cwd,
      options.workspaceRoot ?? readOptionalEnv('GITHUB_WORKSPACE') ?? cwd
    ),
    repository: {
      ...detectedRepository.repository,
      ...githubRepository,
    },
    pullRequest: normalizePullRequest(event?.pull_request),
    platform,
    artifactPath: resolveFromCwd(cwd, artifactPath),
    appId: options.appId ?? readOptionalEnv('CALI_APP_ID'),
    deviceName: options.deviceName ?? readOptionalEnv('CALI_DEVICE_NAME'),
    outputDir: resolveFromCwd(cwd, outputDir),
    buildId,
    workflowUrl,
    logsUrl: options.logsUrl,
  })
}

async function buildEasContext(
  cwd: string,
  options: WriteMobilePrContextOptions
): Promise<CaliContext> {
  const detectedRepository = await detectRepositoryContext(cwd)
  const githubRepository = resolveGithubRepositoryContext()
  const outputDir = options.outputDir ?? readOptionalEnv('CALI_OUTPUT_DIR') ?? './artifacts/qa'
  const artifactPath = options.artifactPath ?? readOptionalEnv('APP_PATH')
  const platform = options.platform ?? normalizePlatform(readOptionalEnv('QA_PLATFORM'))

  if (!artifactPath) {
    throw createContextWriterError('EAS context generation requires APP_PATH or --artifact.')
  }

  if (!platform) {
    throw createContextWriterError('EAS context generation requires QA_PLATFORM or --platform.')
  }

  return createCommonContext({
    workspaceRoot: resolveFromCwd(cwd, options.workspaceRoot ?? cwd),
    repository: {
      ...detectedRepository.repository,
      ...githubRepository,
    },
    pullRequest: normalizePullRequest(readPullRequestJson(readOptionalEnv('PR_JSON'))),
    platform,
    artifactPath: resolveFromCwd(cwd, artifactPath),
    appId: options.appId ?? readOptionalEnv('APPLICATION_ID'),
    deviceName: options.deviceName ?? readOptionalEnv('CALI_DEVICE_NAME'),
    outputDir: resolveFromCwd(cwd, outputDir),
    buildId: options.buildId ?? readOptionalEnv('BUILD_ID'),
    workflowUrl: options.workflowUrl ?? readOptionalEnv('WORKFLOW_URL'),
    logsUrl: options.logsUrl ?? readOptionalEnv('LOGS_URL'),
  })
}

function removeUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedValues).filter((entry) => entry !== undefined)
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([entryKey, entryValue]) => [entryKey, removeUndefinedValues(entryValue)] as const)
      .filter(([, entryValue]) => entryValue !== undefined)
    if (entries.length === 0) {
      return undefined
    }

    return Object.fromEntries(entries)
  }

  return value
}

export async function writeMobilePrContext(options: WriteMobilePrContextOptions) {
  const cwd = process.cwd()
  const context =
    options.from === 'github-actions'
      ? await buildGithubActionsContext(cwd, options)
      : await buildEasContext(cwd, options)
  const outputPath = resolveFromCwd(cwd, options.outputPath)

  await ensureDirectory(path.dirname(outputPath))
  await writeFile(
    outputPath,
    `${JSON.stringify(removeUndefinedValues(context) ?? {}, null, 2)}\n`,
    'utf8'
  )

  console.log(`Wrote ${outputPath}`)
}
