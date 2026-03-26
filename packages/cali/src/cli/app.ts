import { cac } from 'cac'

import { printRetroBanner } from './banner.js'
import { registerQaCommand } from './qa.js'

function createCli() {
  const cli = cac('cali')

  cli.usage('<command> [options]')
  registerQaCommand(cli, printRetroBanner)
  cli.help()

  return cli
}

export async function runCli(argv = process.argv) {
  const cli = createCli()
  const args = argv.slice(2)
  const shouldPrintBanner = args.length === 0 || args.includes('--help') || args.includes('-h')

  if (shouldPrintBanner) {
    printRetroBanner()
  }

  await Promise.resolve(cli.parse(argv))

  if (args.length === 0) {
    cli.outputHelp()
  }
}
