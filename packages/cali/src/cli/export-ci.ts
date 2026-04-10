import type { CAC } from 'cac'

import { exportCi } from '../commands/export-ci.js'
import { readOptionalString } from './shared.js'

type ExportCiCliOptions = {
  target?: string
  report?: string
  outputDir?: string
}

function normalizeTarget(value: unknown) {
  if (value === 'eas') {
    return 'eas' as const
  }

  throw new Error('`--target` must be `eas`.')
}

export const exportCiCommandDefinition = {
  register(cli: CAC) {
    cli
      .command('export-ci', 'Export provider-specific CI helper files from a Cali report')
      .option('--target <name>', 'CI target', {
        default: 'eas',
      })
      .option('--report <path>', 'Path to report.json')
      .option('--output-dir <path>', 'Output directory for exported helper files')
      .example('export-ci --target eas --report ./artifacts/qa/report.json')
      .action(async (options: unknown) => {
        const normalized = options as ExportCiCliOptions
        const reportPath = readOptionalString(normalized.report)
        if (!reportPath) {
          throw new Error('`export-ci` requires `--report <path>`.')
        }

        await exportCi({
          target: normalizeTarget(normalized.target ?? 'eas'),
          reportPath,
          outputDir: readOptionalString(normalized.outputDir),
        })
      })
  },
}
