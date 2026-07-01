import type { CAC } from 'cac'

import { exportCi } from '../commands/export-ci.js'
import { readOptionalString } from './shared.js'

type ExportCiCliOptions = {
  report?: string
  android?: string
  ios?: string
  outputDir?: string
}

export const exportCiCommandDefinition = {
  register(cli: CAC) {
    cli
      .command('export-ci', 'Export shared CI outputs from one or more Cali reports')
      .option('--report <path>', 'Path to report.json')
      .option('--android <path>', 'Path to Android report.json for a multi-platform export')
      .option('--ios <path>', 'Path to iOS report.json for a multi-platform export')
      .option('--output-dir <path>', 'Output directory for exported CI outputs')
      .example('export-ci --report ./artifacts/qa/report.json')
      .example(
        'export-ci --android ./artifacts/android/report.json --ios ./artifacts/ios/report.json'
      )
      .action(async (options: unknown) => {
        const normalized = options as ExportCiCliOptions
        const reportPath = readOptionalString(normalized.report)
        const androidReportPath = readOptionalString(normalized.android)
        const iosReportPath = readOptionalString(normalized.ios)

        await exportCi({
          reportPath,
          androidReportPath,
          iosReportPath,
          outputDir: readOptionalString(normalized.outputDir),
        })
      })
  },
}
