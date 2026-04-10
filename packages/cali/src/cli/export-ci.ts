import type { CAC } from 'cac'

import { exportCi } from '../commands/export-ci.js'
import { readOptionalString } from './shared.js'

type ExportCiCliOptions = {
  report?: string
  outputDir?: string
}

export const exportCiCommandDefinition = {
  register(cli: CAC) {
    cli
      .command('export-ci', 'Export shared CI helper files from a Cali report')
      .option('--report <path>', 'Path to report.json')
      .option('--output-dir <path>', 'Output directory for exported helper files')
      .example('export-ci --report ./artifacts/qa/report.json')
      .action(async (options: unknown) => {
        const normalized = options as ExportCiCliOptions
        const reportPath = readOptionalString(normalized.report)
        if (!reportPath) {
          throw new Error('`export-ci` requires `--report <path>`.')
        }

        await exportCi({
          reportPath,
          outputDir: readOptionalString(normalized.outputDir),
        })
      })
  },
}
