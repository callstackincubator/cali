import type { CAC } from 'cac'

import { writeMobilePrContext } from '../commands/write-mobile-pr-context.js'
import { readOptionalString } from './shared.js'

type WriteMobilePrContextCliOptions = {
  from?: string
  output?: string
  platform?: string
  artifact?: string
  appId?: string
  device?: string
  outputDir?: string
  workspaceRoot?: string
  buildId?: string
  workflowUrl?: string
  logsUrl?: string
}

function normalizeProvider(value: unknown) {
  if (value === 'github-actions' || value === 'eas') {
    return value
  }

  throw new Error('`--from` must be `github-actions` or `eas`.')
}

export const writeMobilePrContextCommandDefinition = {
  register(cli: CAC) {
    cli
      .command(
        'write-mobile-pr-context',
        'Write a normalized cali-context.json from GitHub Actions or EAS environment variables'
      )
      .option('--from <provider>', 'Context source: github-actions or eas')
      .option('--output <path>', 'Output file path', {
        default: './cali-context.json',
      })
      .option('--platform <name>', 'Override platform: android or ios')
      .option('--artifact <path>', 'Override artifact path')
      .option('--app-id <id>', 'Override application identifier')
      .option('--device <name>', 'Override simulator or emulator name')
      .option('--output-dir <path>', 'Override report output directory')
      .option('--workspace-root <path>', 'Override workspace root')
      .option('--build-id <id>', 'Override build identifier')
      .option('--workflow-url <url>', 'Override workflow URL')
      .option('--logs-url <url>', 'Override logs URL')
      .example('write-mobile-pr-context --from eas --output ./cali-context.json')
      .example('write-mobile-pr-context --from github-actions --output ./cali-context.json')
      .action(async (options: unknown) => {
        const normalized = options as WriteMobilePrContextCliOptions
        if (!normalized.from) {
          throw new Error('`write-mobile-pr-context` requires `--from <provider>`.')
        }

        await writeMobilePrContext({
          from: normalizeProvider(normalized.from),
          outputPath: readOptionalString(normalized.output) ?? './cali-context.json',
          platform: readOptionalString(normalized.platform) as 'android' | 'ios' | undefined,
          artifactPath: readOptionalString(normalized.artifact),
          appId: readOptionalString(normalized.appId),
          deviceName: readOptionalString(normalized.device),
          outputDir: readOptionalString(normalized.outputDir),
          workspaceRoot: readOptionalString(normalized.workspaceRoot),
          buildId: readOptionalString(normalized.buildId),
          workflowUrl: readOptionalString(normalized.workflowUrl),
          logsUrl: readOptionalString(normalized.logsUrl),
        })
      })
  },
}
