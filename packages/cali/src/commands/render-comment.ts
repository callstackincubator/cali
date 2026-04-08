import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { renderGithubComment } from '../report/ci.js'
import type { CommandReport } from '../report/types.js'
import { ensureDirectory, resolveFromCwd } from '../utils.js'

export type RenderCommentOptions = {
  reportPath: string
  format: 'github'
  outputPath?: string
}

export async function renderComment(options: RenderCommentOptions) {
  const cwd = process.cwd()
  const reportPath = resolveFromCwd(cwd, options.reportPath)
  const content = await readFile(reportPath, 'utf8')
  const report = JSON.parse(content) as CommandReport

  const rendered =
    options.format === 'github' ? renderGithubComment(report) : renderGithubComment(report)

  if (options.outputPath) {
    const outputPath = resolveFromCwd(cwd, options.outputPath)
    await ensureDirectory(path.dirname(outputPath))
    await writeFile(outputPath, rendered, 'utf8')
    console.log(`Wrote ${outputPath}`)
    return
  }

  process.stdout.write(rendered)
}
