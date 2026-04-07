import type { PublisherName } from '../config/schema.js'
import { publishBlobReport } from '../report/publishers/blob.js'
import { publishFileReport } from '../report/publishers/file.js'
import type { CommandReport, ReportPublisherResult } from '../report/types.js'

type PublishReportOptions = {
  report: CommandReport
  publishers: PublisherName[]
}

export async function publishReport(options: PublishReportOptions) {
  const { report, publishers } = options
  let currentReport = report
  const publisherResults: ReportPublisherResult[] = []

  for (const publisher of publishers) {
    if (publisher === 'file') {
      continue
    }

    try {
      if (publisher === 'blob') {
        const blobResult = await publishBlobReport({ report: currentReport })
        currentReport = blobResult.report
        publisherResults.push(blobResult.publisherResult)
        continue
      }

      publisherResults.push({
        publisher,
        status: 'ok',
      })
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
      publisherResults.push({
        publisher,
        status: 'failed',
        detail: error.message,
      })
    }
  }

  if (publishers.includes('file')) {
    currentReport = await publishFileReport({
      report: currentReport,
      publisherResults: [
        ...publisherResults,
        {
          publisher: 'file',
          status: 'ok',
        },
      ],
    })
  } else {
    currentReport = {
      ...currentReport,
      publisherResults,
    }
  }

  return currentReport
}
