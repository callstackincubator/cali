import type { CAC } from 'cac'

import { runDevCommand } from '../commands/dev.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonCommandOptions,
} from './shared.js'

export const devCommandDefinition = {
  register(cli: CAC) {
    registerCommonCommandOptions(
      cli.command('dev', 'Run the mobile development role (experimental)')
    )
      .example('dev --env mobile-pr --context ./cali-context.json --prompt "implement issue 123"')
      .action(async (options: unknown) => {
        await runDevCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
