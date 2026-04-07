import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { cosmiconfig } from 'cosmiconfig'

import type { CommandResolvedConfig } from '../runtime/types.js'
import type { CommandConfigKey } from '../runtime/types.js'
import { asArray, resolveFromCwd, uniqueStrings } from '../utils.js'
import type {
  CaliCommandConfig,
  CaliConfig,
  CaliEnvName,
  CommandId,
  PublisherName,
} from './schema.js'
import { CaliConfigSchema, normalizeCaliEnvName } from './schema.js'

type LoadCommandConfigOptions = {
  commandId: CommandId
  cwd: string
  configPath?: string
  envName?: CaliEnvName
  model?: string
}

function getBuiltInSkillPaths(cwd: string) {
  return [path.join(cwd, '.agents', 'skills'), path.join(homedir(), '.agents', 'skills')]
}

const QA_ENV_DEFAULTS: Record<CaliEnvName, CaliCommandConfig> = {
  'mobile-pr': {
    enabledToolPacks: ['skills', 'agent-device'],
    outputPublishers: ['blob', 'file'],
    extraInstructions: [
      'Infer concise acceptance criteria from pull request or task metadata and prioritize user-visible flows.',
      'Treat the repository as a black box and avoid source inspection unless the config explicitly says otherwise.',
    ],
  },
  'local-ios': {
    enabledToolPacks: ['skills', 'agent-device'],
    outputPublishers: ['blob', 'file'],
    mobileDefaults: {
      platform: 'ios',
    },
    extraInstructions: [
      'This is a local iOS QA run. Keep the flow lightweight and focus on the highest-signal UI paths.',
    ],
  },
  'local-android': {
    enabledToolPacks: ['skills', 'agent-device'],
    outputPublishers: ['blob', 'file'],
    mobileDefaults: {
      platform: 'android',
    },
    extraInstructions: [
      'This is a local Android QA run. Keep the flow lightweight and focus on the highest-signal UI paths.',
    ],
  },
}

function getDefaultEnvName(commandId: CommandId): CaliEnvName {
  switch (commandId) {
    case 'review':
    case 'dev':
      return 'mobile-pr'
    case 'qa':
    case 'perf-review':
    default:
      return 'local-android'
  }
}

function getEnvCommandDefaults(commandId: CommandId, envName: CaliEnvName): CaliCommandConfig {
  const commonOutputPublishers: PublisherName[] = ['file']
  const mobileOutputPublishers: PublisherName[] = ['blob', 'file']

  switch (commandId) {
    case 'qa':
      return QA_ENV_DEFAULTS[envName]
    case 'perf-review':
      switch (envName) {
        case 'mobile-pr':
          return {
            enabledToolPacks: ['skills', 'agent-device', 'react-devtools', 'repo-read'],
            outputPublishers: mobileOutputPublishers,
            extraInstructions: [
              'Focus on high-signal runtime performance evidence such as rerenders, slow interactions, and component-level bottlenecks.',
            ],
          }
        case 'local-ios':
          return {
            enabledToolPacks: ['skills', 'agent-device', 'react-devtools', 'repo-read'],
            outputPublishers: mobileOutputPublishers,
            mobileDefaults: {
              platform: 'ios',
            },
          }
        case 'local-android':
        default:
          return {
            enabledToolPacks: ['skills', 'agent-device', 'react-devtools', 'repo-read'],
            outputPublishers: mobileOutputPublishers,
            mobileDefaults: {
              platform: 'android',
            },
          }
      }
    case 'review':
      return {
        enabledToolPacks: ['repo-read', 'skills'],
        outputPublishers: commonOutputPublishers,
      }
    case 'dev':
      return {
        enabledToolPacks: ['repo-read', 'repo-write', 'skills'],
        outputPublishers: commonOutputPublishers,
      }
  }
}

const COMMAND_CONFIG_KEYS: Record<CommandId, CommandConfigKey> = {
  qa: 'qa',
  review: 'review',
  'perf-review': 'perfReview',
  dev: 'dev',
}

function getCommandConfig(config: CaliConfig, key: CommandConfigKey): CaliCommandConfig {
  return config.commands?.[key] ?? {}
}

function mergeCommandConfig(
  base: CaliCommandConfig,
  override: CaliCommandConfig
): CaliCommandConfig {
  return {
    contextPath: override.contextPath ?? base.contextPath,
    enabledToolPacks: override.enabledToolPacks ?? base.enabledToolPacks,
    outputPublishers: override.outputPublishers ?? base.outputPublishers,
    extraInstructions: [...asArray(base.extraInstructions), ...asArray(override.extraInstructions)],
    model: override.model ?? base.model,
    mobileDefaults: {
      ...base.mobileDefaults,
      ...override.mobileDefaults,
    },
  }
}

export async function loadCaliConfigFile(cwd: string, explicitPath?: string): Promise<CaliConfig> {
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
    return CaliConfigSchema.parse(loaded?.config ?? {})
  }

  const loaded = await explorer.search(cwd)

  return CaliConfigSchema.parse(loaded?.config ?? {})
}

export async function loadCommandConfig(
  options: LoadCommandConfigOptions
): Promise<CommandResolvedConfig> {
  const { commandId, cwd, configPath, envName: cliEnvName, model } = options
  const fileConfig = await loadCaliConfigFile(cwd, configPath)
  const envName = cliEnvName ?? normalizeCaliEnvName(fileConfig.env) ?? getDefaultEnvName(commandId)
  const envDefaults = getEnvCommandDefaults(commandId, envName)
  const commandConfig = getCommandConfig(fileConfig, COMMAND_CONFIG_KEYS[commandId])
  const merged = mergeCommandConfig(envDefaults, commandConfig)

  return {
    envName,
    workspaceRoot: fileConfig.workspaceRoot
      ? resolveFromCwd(cwd, fileConfig.workspaceRoot)
      : undefined,
    contextPath: merged.contextPath ? resolveFromCwd(cwd, merged.contextPath) : undefined,
    skillPaths: uniqueStrings([...(fileConfig.skillPaths ?? []), ...getBuiltInSkillPaths(cwd)]),
    enabledToolPacks: merged.enabledToolPacks ?? [],
    outputPublishers: merged.outputPublishers ?? ['file'],
    extraInstructions: asArray(merged.extraInstructions),
    model:
      model ?? merged.model ?? fileConfig.model ?? process.env.QA_MODEL ?? 'openai/gpt-5.4-mini',
    mobileDefaults: merged.mobileDefaults ?? {},
  }
}
