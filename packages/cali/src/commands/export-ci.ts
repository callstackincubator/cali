import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { buildScreenshotsMetadata, getTopIssue, renderScreenshotsCell } from '../report/ci.js'
import { renderCommandSection } from '../report/render.js'
import type { CommandReport } from '../report/types.js'
import { ensureDirectory, resolveFromCwd } from '../utils.js'

export type ExportCiOptions = {
  target: 'eas'
  reportPath: string
  outputDir?: string
}

export async function exportCi(options: ExportCiOptions) {
  const cwd = process.cwd()
  const reportPath = resolveFromCwd(cwd, options.reportPath)
  const content = await readFile(reportPath, 'utf8')
  const report = JSON.parse(content) as CommandReport
  const outputDir = resolveFromCwd(cwd, options.outputDir ?? path.dirname(reportPath))

  await ensureDirectory(outputDir)

  const topIssue =
    getTopIssue(report) ?? (report.overallStatus === 'passed' ? 'N/A' : report.summary)

  await writeFile(path.join(outputDir, 'eas-status.txt'), `${report.overallStatus}\n`, 'utf8')
  await writeFile(path.join(outputDir, 'eas-top-issue.txt'), `${topIssue}\n`, 'utf8')
  await writeFile(path.join(outputDir, 'eas-section-body.md'), renderCommandSection(report), 'utf8')
  await writeFile(
    path.join(outputDir, 'eas-screenshots-cell.md'),
    `${renderScreenshotsCell(report)}\n`,
    'utf8'
  )
  await writeFile(
    path.join(outputDir, 'eas-screenshots.json'),
    `${JSON.stringify(buildScreenshotsMetadata(report), null, 2)}\n`,
    'utf8'
  )

  console.log(`Exported ${options.target} CI helpers to ${outputDir}`)
}
