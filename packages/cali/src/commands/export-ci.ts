import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import {
  buildScreenshotsMetadata,
  getTopIssue,
  renderGithubComment,
  renderGithubMultiPlatformComment,
} from '../report/ci.js'
import type { CommandReport } from '../report/types.js'
import { ensureDirectory, resolveFromCwd } from '../utils.js'

const ResultStatusSchema = z.enum(['passed', 'failed', 'blocked', 'not_tested', 'unsure'])

const BaseReportSchema = z
  .object({
    command: z.enum(['qa', 'review', 'perf-review', 'dev']),
    overallStatus: ResultStatusSchema,
    summary: z.string(),
    nextSteps: z.array(z.string()).optional(),
    environmentNotes: z.array(z.string()).optional(),
    publisherResults: z
      .array(
        z.object({
          publisher: z.string(),
          status: z.enum(['ok', 'skipped', 'failed']),
          detail: z.string().optional(),
        })
      )
      .optional(),
    context: z.object({
      workspaceRoot: z.string(),
      repository: z
        .object({
          owner: z.string().optional(),
          name: z.string().optional(),
        })
        .passthrough()
        .optional(),
      pullRequest: z
        .object({
          number: z.number().optional(),
        })
        .passthrough()
        .optional(),
      build: z
        .object({
          id: z.string().optional(),
          workflowUrl: z.string().optional(),
        })
        .passthrough()
        .optional(),
      mobile: z
        .object({
          platform: z.enum(['android', 'ios']).optional(),
        })
        .passthrough()
        .optional(),
    }),
  })
  .passthrough()

const ScreenshotInfoSchema = z
  .object({
    fileName: z.string(),
    label: z.string(),
    blobUrl: z.string().optional(),
    blobDownloadUrl: z.string().optional(),
    blobPathname: z.string().optional(),
    uploadError: z.string().optional(),
  })
  .passthrough()

const ExportableReportSchema = z.discriminatedUnion('command', [
  BaseReportSchema.extend({
    command: z.literal('qa'),
    checked: z.array(z.string()),
    issues: z.array(z.string()),
    acceptanceCriteriaUsed: z.array(z.string()),
    screenshots: z.array(ScreenshotInfoSchema),
  }),
  BaseReportSchema.extend({
    command: z.literal('review'),
    findings: z.array(
      z.object({
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        title: z.string(),
        body: z.string(),
        file: z.string().optional(),
        lineStart: z.number().optional(),
        lineEnd: z.number().optional(),
      })
    ),
    strengths: z.array(z.string()),
    validationGaps: z.array(z.string()),
  }),
  BaseReportSchema.extend({
    command: z.literal('perf-review'),
    scenario: z.string(),
    slowComponents: z.array(z.object({ label: z.string(), detail: z.string() })),
    rerenderHotspots: z.array(z.object({ label: z.string(), detail: z.string() })),
    suspectedCauses: z.array(z.string()),
    evidence: z.array(
      z.object({
        kind: z.enum(['component', 'profile', 'screenshot', 'note']),
        label: z.string(),
        detail: z.string(),
        reference: z.string().optional(),
      })
    ),
    recommendedFixes: z.array(z.string()),
    screenshots: z.array(ScreenshotInfoSchema),
  }),
  BaseReportSchema.extend({
    command: z.literal('dev'),
    filesChanged: z.array(z.string()),
    validationsRun: z.array(z.string()),
    followUps: z.array(z.string()),
    patchStatus: z.enum(['applied', 'planned', 'blocked', 'partial']),
  }),
])

export type ExportCiOptions = {
  reportPath?: string
  androidReportPath?: string
  iosReportPath?: string
  outputDir?: string
}

type SinglePlatformCiOutput = {
  kind: 'single-platform'
  status: CommandReport['overallStatus']
  summary: string
  topIssue: string
  screenshots: ReturnType<typeof buildScreenshotsMetadata>
}

type PlatformCiOutput = {
  status: CommandReport['overallStatus']
  summary: string
  topIssue: string
  screenshots: ReturnType<typeof buildScreenshotsMetadata>
}

type MultiPlatformCiOutput = {
  kind: 'multi-platform'
  status: CommandReport['overallStatus'] | 'mixed'
  summary: string
  topIssue: string
  platforms: {
    android?: PlatformCiOutput
    ios?: PlatformCiOutput
  }
}

export async function exportCi(options: ExportCiOptions) {
  const cwd = process.cwd()
  const reports = await loadReports(cwd, options)
  const outputDir = resolveOutputDirectory(cwd, options)

  await ensureDirectory(outputDir)

  const output = reports.report
    ? createSinglePlatformOutput(reports.report)
    : createMultiPlatformOutput(reports)
  const comment = reports.report
    ? renderGithubComment(reports.report)
    : renderGithubMultiPlatformComment({
        android: reports.android,
        ios: reports.ios,
      })

  await writeFile(path.join(outputDir, 'ci-comment.md'), comment, 'utf8')
  await writeFile(
    path.join(outputDir, 'ci-output.json'),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8'
  )

  console.log(`Exported CI outputs to ${outputDir}`)
}

async function loadReports(cwd: string, options: ExportCiOptions) {
  if (options.reportPath) {
    if (options.androidReportPath || options.iosReportPath) {
      throw new Error(
        '`export-ci` accepts either `--report <path>` or multi-platform `--android <path>` / `--ios <path>`, not both.'
      )
    }

    return {
      report: await readReport(resolveFromCwd(cwd, options.reportPath)),
      android: undefined,
      ios: undefined,
    }
  }

  if (!options.androidReportPath && !options.iosReportPath) {
    throw new Error(
      '`export-ci` requires `--report <path>` or at least one of `--android <path>` / `--ios <path>`.'
    )
  }

  const [android, ios] = await Promise.all([
    options.androidReportPath
      ? readReport(resolveFromCwd(cwd, options.androidReportPath))
      : Promise.resolve(undefined),
    options.iosReportPath
      ? readReport(resolveFromCwd(cwd, options.iosReportPath))
      : Promise.resolve(undefined),
  ])

  return {
    report: undefined,
    android,
    ios,
  }
}

function resolveOutputDirectory(cwd: string, options: ExportCiOptions) {
  if (options.outputDir) {
    return resolveFromCwd(cwd, options.outputDir)
  }

  const basePath = options.reportPath ?? options.androidReportPath ?? options.iosReportPath
  if (!basePath) {
    throw new Error('Unable to resolve output directory for exported CI files.')
  }

  return resolveFromCwd(cwd, path.dirname(basePath))
}

function createSinglePlatformOutput(report: CommandReport): SinglePlatformCiOutput {
  return {
    kind: 'single-platform',
    status: report.overallStatus,
    summary: report.summary,
    topIssue: getDefaultTopIssue(report),
    screenshots: buildScreenshotsMetadata(report),
  }
}

function createMultiPlatformOutput(reports: {
  android?: CommandReport
  ios?: CommandReport
}): MultiPlatformCiOutput {
  const platforms = {
    android: reports.android ? createPlatformOutput(reports.android) : undefined,
    ios: reports.ios ? createPlatformOutput(reports.ios) : undefined,
  }

  const statuses = [platforms.android?.status, platforms.ios?.status].filter(
    (status): status is CommandReport['overallStatus'] => Boolean(status)
  )
  const status = summarizeStatuses(statuses)
  const summary = [
    platforms.android ? `Android: ${platforms.android.status}` : undefined,
    platforms.ios ? `iOS: ${platforms.ios.status}` : undefined,
  ]
    .filter(Boolean)
    .join('. ')

  return {
    kind: 'multi-platform',
    status,
    summary: summary || 'No platform reports provided.',
    topIssue:
      platforms.android?.topIssue !== 'N/A'
        ? `Android: ${platforms.android?.topIssue}`
        : platforms.ios?.topIssue !== 'N/A'
          ? `iOS: ${platforms.ios?.topIssue}`
          : 'N/A',
    platforms,
  }
}

function createPlatformOutput(report: CommandReport): PlatformCiOutput {
  return {
    status: report.overallStatus,
    summary: report.summary,
    topIssue: getDefaultTopIssue(report),
    screenshots: buildScreenshotsMetadata(report),
  }
}

function summarizeStatuses(
  statuses: CommandReport['overallStatus'][]
): CommandReport['overallStatus'] | 'mixed' {
  if (statuses.length === 0) {
    return 'blocked'
  }

  if (statuses.every((status) => status === statuses[0])) {
    return statuses[0]!
  }

  return 'mixed'
}

function getDefaultTopIssue(report: CommandReport) {
  return getTopIssue(report) ?? (report.overallStatus === 'passed' ? 'N/A' : report.summary)
}

async function readReport(reportPath: string) {
  const content = await readFile(reportPath, 'utf8')
  return ExportableReportSchema.parse(JSON.parse(content)) as CommandReport
}
