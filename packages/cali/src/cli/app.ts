import { cac } from 'cac'

import { loadCaliConfigFile } from '../config/load.js'
import { printRetroBanner } from './banner.js'
import { devCommandDefinition } from './dev.js'
import { perfReviewCommandDefinition } from './perf-review.js'
import { qaCommandDefinition } from './qa.js'
import { reviewCommandDefinition } from './review.js'

function createCli() {
  const cli = cac('cali')

  cli.usage('<command> [options]')
  for (const commandDefinition of [
    qaCommandDefinition,
    reviewCommandDefinition,
    perfReviewCommandDefinition,
    devCommandDefinition,
  ]) {
    commandDefinition.register(cli, printRetroBanner)
  }
  cli.help()

  return cli
}

export async function runCli(argv = process.argv) {
  const cli = createCli()
  const args = argv.slice(2)
  const shouldPrintBanner = args.length === 0 || args.includes('--help') || args.includes('-h')
  const cwd = process.cwd()

  if (shouldPrintBanner) {
    printRetroBanner()
  }

  if (args.length === 0) {
    const config = await loadCaliConfigFile(cwd)
    if (config.defaultCommand) {
      await Promise.resolve(
        cli.parse([argv[0] ?? 'node', argv[1] ?? 'cali', config.defaultCommand])
      )
      return
    }
  }

  await Promise.resolve(cli.parse(argv))

  if (args.length === 0) {
    cli.outputHelp()
  }
}
