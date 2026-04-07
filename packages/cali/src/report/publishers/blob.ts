import { readFile } from 'node:fs/promises'

import { put } from '@vercel/blob'

import type { CommandReport, PerfReviewReport, QaReport } from '../types.js'

type BlobPublishOptions = {
  report: CommandReport
}

function hasScreenshots(report: CommandReport): report is QaReport | PerfReviewReport {
  return 'screenshots' in report
}

export async function publishBlobReport({ report }: BlobPublishOptions): Promise<CommandReport> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || !hasScreenshots(report) || report.screenshots.length === 0) {
    return report
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

  return {
    ...report,
    screenshots,
  } satisfies CommandReport
}
