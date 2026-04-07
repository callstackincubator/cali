import type { CAC } from 'cac'

import { runQaCommand } from '../commands/qa.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonMobileOptions,
} from './shared.js'

export const qaCommandDefinition = {
  register(cli: CAC, printBanner: () => void) {
    registerCommonMobileOptions(cli.command('qa', 'Run the mobile QA role'))
      .example(
        'qa --env local-ios --artifact ./artifacts/MyApp.app --prompt "verify the onboarding copy on Screen B"'
      )
      .action(async (options: unknown) => {
        printBanner()
        await runQaCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
