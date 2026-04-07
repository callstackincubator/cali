import type { CAC } from 'cac'

import { runPerfReviewCommand } from '../commands/perf-review.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonMobileOptions,
} from './shared.js'

export const perfReviewCommandDefinition = {
  register(cli: CAC) {
    registerCommonMobileOptions(
      cli.command('perf-review', 'Run the mobile performance review role (experimental)')
    )
      .example(
        'perf-review --env mobile-pr --context ./cali-context.json --prompt "profile the checkout flow"'
      )
      .action(async (options: unknown) => {
        await runPerfReviewCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
