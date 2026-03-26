import { existsSync } from 'node:fs'
import path from 'node:path'

import { cosmiconfig } from 'cosmiconfig'

import type { QaResolvedConfig } from '../env/types.js'
import { asArray, resolveFromCwd, uniqueStrings } from '../utils.js'
import type { CaliQaConfig, PublisherName, QaPresetName, ToolPackName } from './schema.js'
import { CaliQaConfigSchema } from './schema.js'

type LoadQaConfigOptions = {
  cwd: string
  configPath?: string
  presetName?: QaPresetName
  model?: string
}

function hasGatewayCredentials() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_KEY)
}

function hasAnthropicCredentials() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.CLAUDE_API_KEY ||
      process.env.CLAUDE_AUTH_TOKEN
  )
}

function getDefaultModel() {
  if (process.env.QA_MODEL) {
    return process.env.QA_MODEL
  }

  if (!hasGatewayCredentials() && hasAnthropicCredentials()) {
    return 'anthropic/claude-sonnet-4.6'
  }

  return 'openai/gpt-5.4'
}

function getBuiltInSkillPaths(cwd: string) {
  return [path.join(cwd, 'node_modules', 'agent-device', 'skills')]
}

function getPresetConfig(cwd: string, presetName: QaPresetName): CaliQaConfig {
  const enabledToolPacks: ToolPackName[] = ['skills', 'agent-device']
  const outputPublishers: PublisherName[] = ['blob', 'file']
  const common = {
    role: 'qa' as const,
    skillPaths: getBuiltInSkillPaths(cwd),
    enabledToolPacks,
    outputPublishers,
  }

  switch (presetName) {
    case 'eas-mobile-pr':
      return {
        ...common,
        preset: presetName,
        environmentAdapter: 'eas-env',
        extraInstructions: [
          'Infer concise acceptance criteria from PR metadata and prioritize user-visible flows.',
          'Treat the repository as a black box and avoid source inspection unless the config explicitly says otherwise.',
        ],
      }
    case 'local-ios':
      return {
        ...common,
        preset: presetName,
        environmentAdapter: 'local-flags',
        platformDefaults: {
          platform: 'ios',
        },
        extraInstructions: [
          'This is a local iOS QA run. Keep the flow lightweight and focus on the highest-signal UI paths.',
        ],
      }
    case 'local-android':
    default:
      return {
        ...common,
        preset: presetName,
        environmentAdapter: 'local-flags',
        platformDefaults: {
          platform: 'android',
        },
        extraInstructions: [
          'This is a local Android QA run. Keep the flow lightweight and focus on the highest-signal UI paths.',
        ],
      }
  }
}

function mergeConfig(base: CaliQaConfig, override: CaliQaConfig): CaliQaConfig {
  return {
    role: override.role ?? base.role ?? 'qa',
    preset: override.preset ?? base.preset,
    environmentAdapter: override.environmentAdapter ?? base.environmentAdapter,
    appId: override.appId ?? base.appId,
    platformDefaults: {
      ...base.platformDefaults,
      ...override.platformDefaults,
    },
    outputDir: override.outputDir ?? base.outputDir,
    skillPaths: uniqueStrings([...(base.skillPaths ?? []), ...(override.skillPaths ?? [])]),
    enabledToolPacks: override.enabledToolPacks ?? base.enabledToolPacks,
    outputPublishers: override.outputPublishers ?? base.outputPublishers,
    extraInstructions: [...asArray(base.extraInstructions), ...asArray(override.extraInstructions)],
    model: override.model ?? base.model,
  }
}

async function loadConfigFile(cwd: string, explicitPath?: string): Promise<CaliQaConfig> {
  const explorer = cosmiconfig('cali', {
    searchPlaces: [
      'cali.config.ts',
      'cali.config.js',
      'cali.config.mjs',
      'cali.config.cjs',
      'cali.config.json',
    ],
  })

  if (explicitPath) {
    const configFilePath = resolveFromCwd(cwd, explicitPath)

    if (!existsSync(configFilePath)) {
      return {}
    }

    const loaded = await explorer.load(configFilePath)
    return CaliQaConfigSchema.parse(loaded?.config ?? {})
  }

  const loaded = await explorer.search(cwd)

  return CaliQaConfigSchema.parse(loaded?.config ?? {})
}

export async function loadQaConfig(options: LoadQaConfigOptions): Promise<QaResolvedConfig> {
  const { cwd, configPath, presetName: cliPresetName, model } = options
  const fileConfig = await loadConfigFile(cwd, configPath)
  const presetName = cliPresetName ?? fileConfig.preset ?? 'local-android'
  const presetConfig = getPresetConfig(cwd, presetName)
  const merged = mergeConfig(presetConfig, fileConfig)

  return {
    role: 'qa',
    presetName,
    environmentAdapter:
      merged.environmentAdapter ?? (presetName === 'eas-mobile-pr' ? 'eas-env' : 'local-flags'),
    appId: merged.appId,
    platformDefaults: merged.platformDefaults ?? {},
    outputDir: merged.outputDir,
    skillPaths: uniqueStrings(merged.skillPaths ?? []),
    enabledToolPacks: merged.enabledToolPacks ?? ['skills', 'agent-device'],
    outputPublishers: merged.outputPublishers ?? ['blob', 'file'],
    extraInstructions: asArray(merged.extraInstructions),
    model: model ?? merged.model ?? getDefaultModel(),
  }
}
