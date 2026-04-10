import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { renderGithubComment, renderGithubMultiPlatformComment } from '../report/ci.js'
import type { CommandReport } from '../report/types.js'
import { ensureDirectory, resolveFromCwd } from '../utils.js'

export type RenderCommentOptions = {
  reportPath?: string
  androidReportPath?: string
  iosReportPath?: string
  format: 'github' | 'github-multi-platform'
  outputPath?: string
}

export async function renderComment(options: RenderCommentOptions) {
  const cwd = process.cwd()
  let rendered: string

  if (options.format === 'github-multi-platform') {
    const [android, ios] = await Promise.all([
      options.androidReportPath
        ? readFile(resolveFromCwd(cwd, options.androidReportPath), 'utf8').then(
            (content) => JSON.parse(content) as CommandReport
          )
        : Promise.resolve(undefined),
      options.iosReportPath
        ? readFile(resolveFromCwd(cwd, options.iosReportPath), 'utf8').then(
            (content) => JSON.parse(content) as CommandReport
          )
        : Promise.resolve(undefined),
    ])

    rendered = renderGithubMultiPlatformComment({
      android,
      ios,
    })
  } else {
    const reportPath = resolveFromCwd(cwd, options.reportPath!)
    const content = await readFile(reportPath, 'utf8')
    const report = JSON.parse(content) as CommandReport
    rendered = renderGithubComment(report)
  }

  if (options.outputPath) {
    const outputPath = resolveFromCwd(cwd, options.outputPath)
    await ensureDirectory(path.dirname(outputPath))
    await writeFile(outputPath, rendered, 'utf8')
    console.log(`Wrote ${outputPath}`)
    return
  }

  process.stdout.write(rendered)
}
