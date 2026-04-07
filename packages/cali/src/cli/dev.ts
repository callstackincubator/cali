import type { CAC } from 'cac'

import { runDevCommand } from '../commands/dev.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonCommandOptions,
} from './shared.js'

export const devCommandDefinition = {
  register(cli: CAC, printBanner: () => void) {
    registerCommonCommandOptions(cli.command('dev', 'Run the mobile development role'))
      .example('dev --env mobile-pr --context ./cali-context.json --prompt "implement issue 123"')
      .action(async (options: unknown) => {
        printBanner()
        await runDevCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
