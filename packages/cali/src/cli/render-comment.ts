import type { CAC } from 'cac'

import { renderComment } from '../commands/render-comment.js'
import { readOptionalString } from './shared.js'

type RenderCommentCliOptions = {
  report?: string
  android?: string
  ios?: string
  format?: string
  output?: string
}

function normalizeFormat(value: unknown) {
  if (!value || value === 'github') {
    return 'github' as const
  }

  if (value === 'github-multi-platform') {
    return 'github-multi-platform' as const
  }

  throw new Error('`--format` must be `github` or `github-multi-platform`.')
}

export const renderCommentCommandDefinition = {
  register(cli: CAC) {
    cli
      .command('render-comment', 'Render a compact comment from a Cali report')
      .option('--report <path>', 'Path to report.json')
      .option('--android <path>', 'Android report.json path for multi-platform rendering')
      .option('--ios <path>', 'iOS report.json path for multi-platform rendering')
      .option('--format <name>', 'Comment format', {
        default: 'github',
      })
      .option('--output <path>', 'Write the rendered comment to a file instead of stdout')
      .example('render-comment --report ./artifacts/qa/report.json --format github')
      .example(
        'render-comment --format github-multi-platform --android ./artifacts/android/report.json --ios ./artifacts/ios/report.json'
      )
      .action(async (options: unknown) => {
        const normalized = options as RenderCommentCliOptions
        const format = normalizeFormat(normalized.format)
        const reportPath = readOptionalString(normalized.report)
        const androidReportPath = readOptionalString(normalized.android)
        const iosReportPath = readOptionalString(normalized.ios)

        if (format === 'github' && !reportPath) {
          throw new Error('`render-comment` requires `--report <path>`.')
        }

        if (format === 'github-multi-platform' && !androidReportPath && !iosReportPath) {
          throw new Error(
            '`render-comment --format github-multi-platform` requires `--android <path>`, `--ios <path>`, or both.'
          )
        }

        await renderComment({
          reportPath,
          androidReportPath,
          iosReportPath,
          format,
          outputPath: readOptionalString(normalized.output),
        })
      })
  },
}
