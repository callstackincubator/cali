import path from 'node:path'
import { writeFile } from 'node:fs/promises'

import { ensureDirectory } from '../../utils.js'
import { renderQaSection } from '../render.js'
import type { QaReport } from '../types.js'

type FilePublishOptions = {
  report: QaReport
}

export async function publishFileReport({ report }: FilePublishOptions): Promise<QaReport> {
  await ensureDirectory(report.context.outputDir)
  await writeFile(
    path.join(report.context.outputDir, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  )
  await writeFile(path.join(report.context.outputDir, 'section.md'), renderQaSection(report), 'utf8')
  await writeFile(path.join(report.context.outputDir, 'status.txt'), `${report.overallStatus}\n`, 'utf8')

  return report
}
