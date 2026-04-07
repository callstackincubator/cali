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
        currentReport = await publishBlobReport({ report: currentReport })
      }

      publisherResults.push({
        publisher,
        ok: true,
      })
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
      publisherResults.push({
        publisher,
        ok: false,
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
          ok: true,
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
