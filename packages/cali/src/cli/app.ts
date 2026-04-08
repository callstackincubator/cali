import { cac } from 'cac'

import { loadCaliConfigFile } from '../config/load.js'
import { printRetroBanner } from './banner.js'
import { devCommandDefinition } from './dev.js'
import { perfReviewCommandDefinition } from './perf-review.js'
import { qaCommandDefinition } from './qa.js'
import { renderCommentCommandDefinition } from './render-comment.js'
import { reviewCommandDefinition } from './review.js'
import { writeMobilePrContextCommandDefinition } from './write-mobile-pr-context.js'

function shouldPrintBanner(args: string[]) {
  if (
    args.includes('--quiet') ||
    args.includes('--help') ||
    args.includes('-h') ||
    process.env.CI === 'true' ||
    process.env.CI === '1'
  ) {
    return false
  }

  return true
}

function createCli() {
  const cli = cac('cali')

  cli.usage('<command> [options]')
  cli.option('--quiet', 'Suppress Cali banner output')
  for (const commandDefinition of [
    qaCommandDefinition,
    reviewCommandDefinition,
    perfReviewCommandDefinition,
    devCommandDefinition,
    writeMobilePrContextCommandDefinition,
    renderCommentCommandDefinition,
  ]) {
    commandDefinition.register(cli)
  }
  cli.help()

  return cli
}

export async function runCli(argv = process.argv) {
  const cli = createCli()
  const args = argv.slice(2)
  const cwd = process.cwd()
  const printBanner = shouldPrintBanner(args)
  if (args.length === 0) {
    const config = await loadCaliConfigFile(cwd)
    if (config.defaultCommand) {
      if (printBanner) {
        printRetroBanner()
      }
      await Promise.resolve(
        cli.parse([argv[0] ?? 'node', argv[1] ?? 'cali', config.defaultCommand])
      )
      return
    }

    if (printBanner) {
      printRetroBanner()
    }
  }

  if (args.length > 0 && printBanner) {
    printRetroBanner()
  }

  await Promise.resolve(cli.parse(argv))

  if (args.length === 0) {
    cli.outputHelp()
  }
}
