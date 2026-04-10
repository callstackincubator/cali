import type { CAC } from 'cac'

import { publishComment } from '../commands/publish-comment.js'
import { readOptionalNumber, readOptionalString } from './shared.js'

type PublishCommentCliOptions = {
  format?: string
  report?: string
  android?: string
  ios?: string
  body?: string
  repo?: string
  prNumber?: string | number
  marker?: string
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

export const publishCommentCommandDefinition = {
  register(cli: CAC) {
    cli
      .command('publish-comment', 'Create or update a GitHub PR comment from Cali output')
      .option('--format <name>', 'Comment format', {
        default: 'github',
      })
      .option('--report <path>', 'Path to report.json')
      .option('--android <path>', 'Android report.json path for multi-platform rendering')
      .option('--ios <path>', 'iOS report.json path for multi-platform rendering')
      .option('--body <path>', 'Path to a pre-rendered markdown comment body')
      .option('--repo <owner/name>', 'GitHub repository override')
      .option('--pr-number <n>', 'Pull request number override')
      .option('--marker <text>', 'Stable marker used to create or update the same comment')
      .example('publish-comment --report ./artifacts/qa/report.json')
      .example(
        'publish-comment --format github-multi-platform --android ./artifacts/android/report.json --ios ./artifacts/ios/report.json'
      )
      .action(async (options: unknown) => {
        const normalized = options as PublishCommentCliOptions
        const format = normalizeFormat(normalized.format)
        const bodyPath = readOptionalString(normalized.body)
        const reportPath = readOptionalString(normalized.report)
        const androidReportPath = readOptionalString(normalized.android)
        const iosReportPath = readOptionalString(normalized.ios)

        if (!bodyPath && format === 'github' && !reportPath) {
          throw new Error('`publish-comment` requires `--report <path>` or `--body <path>`.')
        }

        if (
          !bodyPath &&
          format === 'github-multi-platform' &&
          !androidReportPath &&
          !iosReportPath
        ) {
          throw new Error(
            '`publish-comment --format github-multi-platform` requires `--android <path>`, `--ios <path>`, or `--body <path>`.'
          )
        }

        await publishComment({
          format,
          reportPath,
          androidReportPath,
          iosReportPath,
          bodyPath,
          repo: readOptionalString(normalized.repo),
          prNumber: readOptionalNumber(normalized.prNumber, '--pr-number'),
          marker: readOptionalString(normalized.marker),
        })
      })
  },
}
