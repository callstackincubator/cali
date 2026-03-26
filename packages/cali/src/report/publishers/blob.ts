import { readFile } from 'node:fs/promises'

import { put } from '@vercel/blob'

import type { QaReport } from '../types.js'

type BlobPublishOptions = {
  report: QaReport
}

export async function publishBlobReport({ report }: BlobPublishOptions): Promise<QaReport> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token || report.screenshots.length === 0) {
    return report
  }

  const screenshots = await Promise.all(
    report.screenshots.map(async (screenshot) => {
      try {
        const fileBuffer = await readFile(screenshot.absolutePath)
        const pathnameParts = [
          'cali',
          'qa',
          report.context.platform,
          report.context.metadata.prNumber ? `pr-${report.context.metadata.prNumber}` : 'ad-hoc',
          report.context.buildId || 'local-build',
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
        const error =
          unknownError instanceof Error ? unknownError : new Error(String(unknownError))

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
  }
}
