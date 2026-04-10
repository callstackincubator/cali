import type { CAC } from 'cac'

import { runQaCommand } from '../commands/qa.js'
import type { CiProvider } from '../runtime/ci-context.js'
import {
  type BaseCommandOptions,
  normalizeBaseCommandCliOptions,
  registerCommonMobileOptions,
} from './shared.js'

function normalizeCiProvider(value: unknown): CiProvider | undefined {
  if (value == null || value === '') {
    return undefined
  }

  if (value === 'github-actions' || value === 'eas') {
    return value
  }

  throw new Error('`--ci` must be `github-actions` or `eas`.')
}

export const qaCommandDefinition = {
  register(cli: CAC) {
    registerCommonMobileOptions(
      cli.command('qa', 'Run the mobile QA role'),
      'Built-in env: local-android, local-ios'
    )
      .option('--ci <provider>', 'CI provider context: github-actions or eas')
      .example(
        'qa --env local-ios --artifact ./artifacts/MyApp.app --prompt "verify the onboarding copy on Screen B"'
      )
      .example('qa --ci github-actions --platform ios --artifact ./artifacts/MyApp.app')
      .example('qa --ci eas --platform android --artifact ./artifacts/app.apk')
      .action(async (options: unknown) => {
        const normalized = normalizeBaseCommandCliOptions(options as BaseCommandOptions)
        normalized.ciProvider = normalizeCiProvider((options as BaseCommandOptions).ci)
        await runQaCommand(normalized)
      })
  },
}
