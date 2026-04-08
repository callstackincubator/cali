import { readFile } from 'node:fs/promises'

import { z } from 'zod'

import { resolveFromCwd } from '../utils.js'
import { parseRepositoryUrl, sanitizeUrl } from './context-repo.js'
import type { CaliContext } from './types.js'

const LabelsSchema = z.array(z.string()).optional()

const RepositorySchema = z
  .object({
    provider: z.string().optional(),
    owner: z.string().optional(),
    name: z.string().optional(),
    cloneUrl: z.string().optional(),
    webUrl: z.string().optional(),
    defaultBranch: z.string().optional(),
    currentBranch: z.string().optional(),
    commitSha: z.string().optional(),
  })
  .optional()

const TaskSchema = z
  .object({
    provider: z.string().optional(),
    id: z.string().optional(),
    title: z.string().optional(),
    body: z.string().nullable().optional(),
    url: z.string().optional(),
    labels: LabelsSchema,
  })
  .optional()

const PullRequestSchema = z
  .object({
    number: z.number().optional(),
    title: z.string().optional(),
    body: z.string().nullable().optional(),
    url: z.string().optional(),
    labels: LabelsSchema,
    isDraft: z.boolean().optional(),
    baseBranch: z.string().optional(),
    headBranch: z.string().optional(),
    diffPath: z.string().optional(),
    diffSummary: z.string().optional(),
  })
  .optional()

const MobileSchema = z
  .object({
    platform: z.enum(['android', 'ios']).optional(),
    artifactPath: z.string().optional(),
    appId: z.string().optional(),
    deviceName: z.string().optional(),
  })
  .optional()

const BuildSchema = z
  .object({
    id: z.string().optional(),
    workflowUrl: z.string().optional(),
    logsUrl: z.string().optional(),
  })
  .optional()

const OutputSchema = z
  .object({
    outputDir: z.string().optional(),
    screenshotsDir: z.string().optional(),
  })
  .optional()

function normalizeLabels(values: string[] | undefined) {
  return values ?? []
}

function sanitizeContextUrl(value: string | undefined) {
  return sanitizeUrl(value, { stripQuery: true })
}

function resolveOptionalPath(cwd: string, value?: string) {
  return value ? resolveFromCwd(cwd, value) : undefined
}

function createContextFileSchema(cwd: string) {
  return z
    .object({
      workspaceRoot: z.string().optional(),
      repository: RepositorySchema,
      task: TaskSchema,
      pullRequest: PullRequestSchema,
      mobile: MobileSchema,
      build: BuildSchema,
      output: OutputSchema,
      qa: z
        .object({
          acceptanceCriteria: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .optional(),
      review: z.object({}).optional(),
      perfReview: z
        .object({
          targetFlow: z.string().optional(),
          expectedInteraction: z.string().optional(),
          profilingGoals: LabelsSchema,
          suspectedScreens: LabelsSchema,
        })
        .optional(),
      dev: z
        .object({
          branchStrategy: z.string().optional(),
          allowedValidations: LabelsSchema,
          writePolicy: z.enum(['workspace', 'none']).optional(),
          pushPolicy: z.enum(['disabled', 'manual', 'auto']).optional(),
        })
        .optional(),
    })
    .transform(
      (parsed): Partial<CaliContext> => ({
        workspaceRoot: resolveOptionalPath(cwd, parsed.workspaceRoot),
        repository: parsed.repository
          ? (() => {
              const parsedFromCloneUrl = parseRepositoryUrl(sanitizeUrl(parsed.repository.cloneUrl))

              return {
                provider: parsed.repository.provider ?? parsedFromCloneUrl.provider,
                owner: parsed.repository.owner ?? parsedFromCloneUrl.owner,
                name: parsed.repository.name ?? parsedFromCloneUrl.name,
                webUrl: sanitizeUrl(parsed.repository.webUrl ?? parsedFromCloneUrl.webUrl),
                defaultBranch: parsed.repository.defaultBranch,
                currentBranch: parsed.repository.currentBranch,
                commitSha: parsed.repository.commitSha,
              }
            })()
          : undefined,
        task: parsed.task
          ? {
              ...parsed.task,
              url: sanitizeContextUrl(parsed.task.url),
              labels: normalizeLabels(parsed.task.labels),
            }
          : undefined,
        pullRequest: parsed.pullRequest
          ? {
              ...parsed.pullRequest,
              url: sanitizeContextUrl(parsed.pullRequest.url),
              labels: normalizeLabels(parsed.pullRequest.labels),
              isDraft: parsed.pullRequest.isDraft ?? false,
            }
          : undefined,
        mobile: parsed.mobile
          ? {
              ...parsed.mobile,
              artifactPath: resolveOptionalPath(cwd, parsed.mobile.artifactPath),
            }
          : undefined,
        build: parsed.build
          ? {
              id: parsed.build.id,
              workflowUrl: sanitizeContextUrl(parsed.build.workflowUrl),
              logsUrl: sanitizeContextUrl(parsed.build.logsUrl),
            }
          : undefined,
        output: {
          outputDir: resolveOptionalPath(cwd, parsed.output?.outputDir),
          screenshotsDir: resolveOptionalPath(cwd, parsed.output?.screenshotsDir),
        },
        qa: parsed.qa
          ? {
              acceptanceCriteria: Array.isArray(parsed.qa.acceptanceCriteria)
                ? parsed.qa.acceptanceCriteria
                : parsed.qa.acceptanceCriteria
                  ? [parsed.qa.acceptanceCriteria]
                  : [],
            }
          : undefined,
        review: parsed.review,
        perfReview: parsed.perfReview
          ? {
              ...parsed.perfReview,
              profilingGoals: normalizeLabels(parsed.perfReview.profilingGoals),
              suspectedScreens: normalizeLabels(parsed.perfReview.suspectedScreens),
            }
          : undefined,
        dev: parsed.dev
          ? {
              ...parsed.dev,
              allowedValidations: normalizeLabels(parsed.dev.allowedValidations),
            }
          : undefined,
      })
    )
}

export async function loadContextFile(
  cwd: string,
  contextPath?: string
): Promise<Partial<CaliContext>> {
  if (!contextPath) {
    return {}
  }

  const absolutePath = resolveFromCwd(cwd, contextPath)
  const content = await readFile(absolutePath, 'utf8')
  return createContextFileSchema(cwd).parse(JSON.parse(content))
}
