import type { CAC } from 'cac'

import { renderComment } from '../commands/render-comment.js'
import { readOptionalString } from './shared.js'

type RenderCommentCliOptions = {
  report?: string
  format?: string
  output?: string
}

function normalizeFormat(value: unknown) {
  if (!value || value === 'github') {
    return 'github' as const
  }

  throw new Error('`--format` must be `github`.')
}

export const renderCommentCommandDefinition = {
  register(cli: CAC) {
    cli
      .command('render-comment', 'Render a compact comment from a Cali report')
      .option('--report <path>', 'Path to report.json')
      .option('--format <name>', 'Comment format', {
        default: 'github',
      })
      .option('--output <path>', 'Write the rendered comment to a file instead of stdout')
      .example('render-comment --report ./artifacts/qa/report.json --format github')
      .action(async (options: unknown) => {
        const normalized = options as RenderCommentCliOptions
        const reportPath = readOptionalString(normalized.report)
        if (!reportPath) {
          throw new Error('`render-comment` requires `--report <path>`.')
        }

        await renderComment({
          reportPath,
          format: normalizeFormat(normalized.format),
          outputPath: readOptionalString(normalized.output),
        })
      })
  },
}
