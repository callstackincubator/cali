import type { CAC } from 'cac'

import { runReviewCommand } from '../commands/review.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonCommandOptions,
} from './shared.js'

export const reviewCommandDefinition = {
  register(cli: CAC) {
    registerCommonCommandOptions(
      cli.command('review', 'Run the mobile code review role (experimental)')
    )
      .example('review --env mobile-pr --context ./cali-context.json')
      .action(async (options: unknown) => {
        await runReviewCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
