import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { cosmiconfig } from 'cosmiconfig'

import type { QaResolvedConfig } from '../env/types.js'
import { resolveQaModelId } from '../model.js'
import { asArray, resolveFromCwd, uniqueStrings } from '../utils.js'
import type { CaliQaConfig, PublisherName, QaEnvName, ToolPackName } from './schema.js'
import { CaliQaConfigSchema, normalizeQaEnvName } from './schema.js'

type LoadQaConfigOptions = {
  cwd: string
  configPath?: string
  envName?: QaEnvName
  model?: string
}

function getBuiltInSkillPaths(cwd: string) {
  return [path.join(cwd, '.agents', 'skills'), path.join(homedir(), '.agents', 'skills')]
}

function getEnvConfig(cwd: string, envName: QaEnvName): CaliQaConfig {
  const enabledToolPacks: ToolPackName[] = ['skills', 'agent-device']
  const outputPublishers: PublisherName[] = ['blob', 'file']
  const common = {
    role: 'qa' as const,
    skillPaths: getBuiltInSkillPaths(cwd),
    enabledToolPacks,
    outputPublishers,
  }

  switch (envName) {
    case 'mobile-pr':
      return {
        ...common,
        env: envName,
        extraInstructions: [
          'Infer concise acceptance criteria from pull request or task metadata and prioritize user-visible flows.',
          'Treat the repository as a black box and avoid source inspection unless the config explicitly says otherwise.',
        ],
      }
    case 'local-ios':
      return {
        ...common,
        env: envName,
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
        env: envName,
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
    env: override.env ?? base.env,
    appId: override.appId ?? base.appId,
    contextPath: override.contextPath ?? base.contextPath,
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
  const { cwd, configPath, envName: cliEnvName, model } = options
  const fileConfig = await loadConfigFile(cwd, configPath)
  const envName = cliEnvName ?? normalizeQaEnvName(fileConfig.env) ?? 'local-android'
  const envConfig = getEnvConfig(cwd, envName)
  const merged = mergeConfig(envConfig, fileConfig)

  return {
    envName,
    appId: merged.appId,
    contextPath: merged.contextPath ? resolveFromCwd(cwd, merged.contextPath) : undefined,
    platformDefaults: merged.platformDefaults ?? {},
    outputDir: merged.outputDir,
    skillPaths: uniqueStrings(merged.skillPaths ?? []),
    enabledToolPacks: merged.enabledToolPacks ?? ['skills', 'agent-device'],
    outputPublishers: merged.outputPublishers ?? ['blob', 'file'],
    extraInstructions: asArray(merged.extraInstructions),
    model: resolveQaModelId(model ?? merged.model),
  }
}
