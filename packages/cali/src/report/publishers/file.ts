import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ensureDirectory } from '../../utils.js'
import { renderCommandSection } from '../render.js'
import type { CommandReport, ReportPublisherResult } from '../types.js'

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

  const finalReport = {
    ...report,
    publisherResults,
  } satisfies CommandReport

  await ensureDirectory(outputDir)
  await writeFile(
    path.join(outputDir, 'report.json'),
    `${JSON.stringify(finalReport, null, 2)}\n`,
    'utf8'
  )
  await writeFile(path.join(outputDir, 'section.md'), renderCommandSection(finalReport), 'utf8')
  await writeFile(path.join(outputDir, 'status.txt'), `${finalReport.overallStatus}\n`, 'utf8')
  await writeFile(
    path.join(outputDir, 'publisher-manifest.json'),
    `${JSON.stringify(publisherResults, null, 2)}\n`,
    'utf8'
  )

  return finalReport
}
