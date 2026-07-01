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
      cli.command('perf-review', 'Run the mobile performance review role (experimental)'),
      'Local mobile mode: android or ios'
    )
      .example(
        'perf-review --local ios --artifact ./artifacts/MyApp.app --prompt "profile the checkout flow"'
      )
      .example(
        'perf-review --context ./cali-context.json --platform android --artifact ./artifacts/app.apk --prompt "profile the checkout flow"'
      )
      .action(async (options: unknown) => {
        await runPerfReviewCommand(normalizeBaseCommandCliOptions(options as BaseCommandOptions))
      })
  },
}
