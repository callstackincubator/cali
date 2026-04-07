import type { CAC } from 'cac'

import { runQaCommand } from '../commands/qa.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonMobileOptions,
} from './shared.js'

export const qaCommandDefinition = {
  register(cli: CAC) {
    registerCommonMobileOptions(cli.command('qa', 'Run the mobile QA role'))
      .example(
        'qa --env local-ios --artifact ./artifacts/MyApp.app --prompt "verify the onboarding copy on Screen B"'
      )
      .action(async (options: unknown) => {
        await runQaCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
