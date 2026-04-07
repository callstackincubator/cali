import { readFile } from 'node:fs/promises'

import { z } from 'zod'

import { resolveFromCwd } from '../utils.js'
import type { CaliContext } from './types.js'

const LabelsSchema = z.array(z.string()).optional()

const RepositorySchema = z
  .object({
    provider: z.string().optional(),
    owner: z.string().optional(),
    name: z.string().optional(),
    cloneUrl: z.string().optional(),
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

const CaliContextFileSchema = z.object({
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

function normalizeLabels(values: string[] | undefined) {
  return values ?? []
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
  const parsed = CaliContextFileSchema.parse(JSON.parse(content))

  return {
    workspaceRoot: parsed.workspaceRoot ? resolveFromCwd(cwd, parsed.workspaceRoot) : undefined,
    repository: parsed.repository ? { ...parsed.repository } : undefined,
    task: parsed.task
      ? {
          ...parsed.task,
          labels: normalizeLabels(parsed.task.labels),
        }
      : undefined,
    pullRequest: parsed.pullRequest
      ? {
          ...parsed.pullRequest,
          labels: normalizeLabels(parsed.pullRequest.labels),
          isDraft: parsed.pullRequest.isDraft ?? false,
        }
      : undefined,
    mobile: parsed.mobile
      ? {
          ...parsed.mobile,
          artifactPath: parsed.mobile.artifactPath
            ? resolveFromCwd(cwd, parsed.mobile.artifactPath)
            : undefined,
        }
      : undefined,
    build: parsed.build,
    output: {
      outputDir: parsed.output?.outputDir
        ? resolveFromCwd(cwd, parsed.output.outputDir)
        : undefined,
      screenshotsDir: parsed.output?.screenshotsDir
        ? resolveFromCwd(cwd, parsed.output.screenshotsDir)
        : undefined,
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
  }
}
