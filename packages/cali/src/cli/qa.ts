import type { CAC } from 'cac'

import { runQaCommand } from '../commands/qa.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonMobileOptions,
} from './shared.js'

export const qaCommandDefinition = {
  register(cli: CAC) {
    registerCommonMobileOptions(
      cli.command('qa', 'Run the mobile QA role'),
      'Local mobile mode: android or ios'
    )
      .example(
        'qa --local ios --artifact ./artifacts/MyApp.app --prompt "verify the onboarding copy on Screen B"'
      )
      .example('qa --platform ios --artifact ./artifacts/MyApp.app')
      .example('qa --platform android --artifact ./artifacts/app.apk')
      .action(async (options: unknown) => {
        await runQaCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
