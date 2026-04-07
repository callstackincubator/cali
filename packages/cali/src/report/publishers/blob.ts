import { readFile } from 'node:fs/promises'

import { put } from '@vercel/blob'

import type { CommandReport, PerfReviewReport, QaReport, ReportPublisherResult } from '../types.js'

type BlobPublishOptions = {
  report: CommandReport
}

type BlobPublishResult = {
  report: CommandReport
  publisherResult: ReportPublisherResult
}

function hasScreenshots(report: CommandReport): report is QaReport | PerfReviewReport {
  return 'screenshots' in report
}

export async function publishBlobReport({
  report,
}: BlobPublishOptions): Promise<BlobPublishResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return {
      report,
      publisherResult: {
        publisher: 'blob',
        status: 'skipped',
        detail: 'BLOB_READ_WRITE_TOKEN is not set.',
      },
    }
  }

  if (!hasScreenshots(report) || report.screenshots.length === 0) {
    return {
      report,
      publisherResult: {
        publisher: 'blob',
        status: 'skipped',
        detail: 'No screenshots were recorded for this report.',
      },
    }
  }

  const screenshots = await Promise.all(
    report.screenshots.map(async (screenshot) => {
      try {
        const fileBuffer = await readFile(screenshot.absolutePath)
        const pathnameParts = [
          'cali',
          report.command,
          report.context.mobile?.platform ?? 'workspace',
          report.context.pullRequest?.number ? `pr-${report.context.pullRequest.number}` : 'ad-hoc',
          report.context.build?.id ?? 'local-build',
          screenshot.fileName,
        ]
        const blob = await put(pathnameParts.join('/'), fileBuffer, {
          access: 'public',
          addRandomSuffix: true,
          contentType: 'image/png',
          token,
        })

        return {
          ...screenshot,
          blobUrl: blob.url,
          blobDownloadUrl: blob.downloadUrl,
          blobPathname: blob.pathname,
        }
      } catch (unknownError) {
        const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))

        return {
          ...screenshot,
          uploadError: error.message,
        }
      }
    })
  )

  const failedUploads = screenshots.filter((screenshot) => Boolean(screenshot.uploadError))
  const publisherResult: ReportPublisherResult =
    failedUploads.length === screenshots.length
      ? {
          publisher: 'blob',
          status: 'failed',
          detail: 'Blob uploads failed for every screenshot.',
        }
      : failedUploads.length > 0
        ? {
            publisher: 'blob',
            status: 'ok',
            detail: `Uploaded ${screenshots.length - failedUploads.length}/${screenshots.length} screenshots.`,
          }
        : {
            publisher: 'blob',
            status: 'ok',
            detail: `Uploaded ${screenshots.length} screenshot${screenshots.length === 1 ? '' : 's'}.`,
          }

  return {
    report: {
      ...report,
      screenshots,
    } satisfies CommandReport,
    publisherResult,
  }
}
