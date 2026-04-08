import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { sanitizeUrl } from '../../runtime/context-repo.js'
import { ensureDirectory } from '../../utils.js'
import {
  buildScreenshotsMetadata,
  getTopIssue,
  renderGithubComment,
  renderScreenshotsMarkdown,
} from '../ci.js'
import { renderCommandSection } from '../render.js'
import type { CommandReport, PerfReviewReport, QaReport, ReportPublisherResult } from '../types.js'

function stripScreenshotAbsolutePath<T extends { absolutePath?: string }>(screenshot: T) {
  const { absolutePath, ...safeScreenshot } = screenshot
  void absolutePath
  return safeScreenshot
}

function createPublishedContext(report: CommandReport) {
  return {
    workspaceRoot: '.',
    repository: report.context.repository
      ? {
          provider: report.context.repository.provider,
          owner: report.context.repository.owner,
          name: report.context.repository.name,
          webUrl: sanitizeUrl(report.context.repository.webUrl),
          defaultBranch: report.context.repository.defaultBranch,
          currentBranch: report.context.repository.currentBranch,
          commitSha: report.context.repository.commitSha,
        }
      : undefined,
    task: report.context.task
      ? {
          ...report.context.task,
          url: sanitizeUrl(report.context.task.url, { stripQuery: true }),
        }
      : undefined,
    pullRequest: report.context.pullRequest
      ? {
          ...report.context.pullRequest,
          url: sanitizeUrl(report.context.pullRequest.url, { stripQuery: true }),
          diffPath: undefined,
        }
      : undefined,
    mobile: report.context.mobile
      ? {
          platform: report.context.mobile.platform,
          appId: report.context.mobile.appId,
          deviceName: report.context.mobile.deviceName,
        }
      : undefined,
    build: report.context.build
      ? {
          id: report.context.build.id,
          workflowUrl: sanitizeUrl(report.context.build.workflowUrl, { stripQuery: true }),
        }
      : undefined,
    output: {},
    qa: report.context.qa,
    review: report.context.review,
    perfReview: report.context.perfReview,
    dev: report.context.dev,
  } satisfies CommandReport['context']
}

function createSafePublishedReport(
  report: CommandReport,
  publisherResults: ReportPublisherResult[]
) {
  const baseReport = {
    ...report,
    context: createPublishedContext(report),
    publisherResults,
  } satisfies CommandReport

  if (baseReport.command === 'qa') {
    return {
      ...baseReport,
      screenshots: baseReport.screenshots.map(stripScreenshotAbsolutePath),
      agentDeviceTrace: [],
    } satisfies QaReport
  }

  if (baseReport.command === 'perf-review') {
    return {
      ...baseReport,
      screenshots: baseReport.screenshots.map(stripScreenshotAbsolutePath),
      agentDeviceTrace: [],
      reactDevtoolsTrace: [],
    } satisfies PerfReviewReport
  }

  return baseReport
}

type FilePublishOptions = {
  report: CommandReport
  publisherResults: ReportPublisherResult[]
}

export async function publishFileReport({
  report,
  publisherResults,
}: FilePublishOptions): Promise<CommandReport> {
  const outputDir = report.context.output.outputDir
  if (!outputDir) {
    throw new Error('File publisher requires context.output.outputDir.')
  }

  const finalReport = createSafePublishedReport(report, publisherResults)
  const topIssue = getTopIssue(finalReport) ?? ''

  await ensureDirectory(outputDir)
  await writeFile(
    path.join(outputDir, 'report.json'),
    `${JSON.stringify(finalReport, null, 2)}\n`,
    'utf8'
  )
  await writeFile(path.join(outputDir, 'section.md'), renderCommandSection(finalReport), 'utf8')
  await writeFile(path.join(outputDir, 'summary.txt'), `${finalReport.summary}\n`, 'utf8')
  await writeFile(path.join(outputDir, 'top-issue.txt'), `${topIssue}\n`, 'utf8')
  await writeFile(path.join(outputDir, 'status.txt'), `${finalReport.overallStatus}\n`, 'utf8')
  await writeFile(
    path.join(outputDir, 'status-label.txt'),
    `${finalReport.overallStatus}\n`,
    'utf8'
  )
  await writeFile(
    path.join(outputDir, 'screenshots.md'),
    renderScreenshotsMarkdown(finalReport),
    'utf8'
  )
  await writeFile(
    path.join(outputDir, 'screenshots.json'),
    `${JSON.stringify(buildScreenshotsMetadata(finalReport), null, 2)}\n`,
    'utf8'
  )
  await writeFile(
    path.join(outputDir, 'comment-github.md'),
    renderGithubComment(finalReport),
    'utf8'
  )
  await writeFile(
    path.join(outputDir, 'publisher-manifest.json'),
    `${JSON.stringify(publisherResults, null, 2)}\n`,
    'utf8'
  )

  return {
    ...report,
    publisherResults,
  } satisfies CommandReport
}
