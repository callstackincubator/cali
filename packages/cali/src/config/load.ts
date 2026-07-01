import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { cosmiconfig } from 'cosmiconfig'

import type { CiProvider } from '../runtime/ci-context.js'
import type { CommandResolvedConfig } from '../runtime/types.js'
import type { CommandConfigKey } from '../runtime/types.js'
import { asArray, resolveFromCwd, uniqueStrings } from '../utils.js'
import type {
  CaliCommandConfig,
  CaliConfig,
  CaliPlatform,
  CommandId,
  PublisherName,
} from './schema.js'
import { CaliConfigSchema } from './schema.js'

type LoadCommandConfigOptions = {
  commandId: CommandId
  cwd: string
  configPath?: string
  localPlatform?: CaliPlatform
  ciProvider?: CiProvider
  model?: string
}

export function resolveDefaultLocalPlatform(commandId: CommandId): CaliPlatform | undefined {
  switch (commandId) {
    case 'qa':
    case 'perf-review':
      return 'android'
    case 'review':
    case 'dev':
    default:
      return undefined
  }
}

function getBuiltInSkillPaths(cwd: string) {
  return [path.join(cwd, '.agents', 'skills'), path.join(homedir(), '.agents', 'skills')]
}

const MOBILE_CI_QA_DEFAULTS: CaliCommandConfig = {
  enabledToolPacks: ['skills', 'agent-device'],
  outputPublishers: ['blob', 'file'],
  extraInstructions: [
    'Infer concise acceptance criteria from pull request or task metadata and prioritize user-visible flows.',
    'Treat the repository as a black box and avoid source inspection unless the config explicitly says otherwise.',
  ],
}

function createLocalQaDefaults(platform: CaliPlatform): CaliCommandConfig {
  return {
    enabledToolPacks: ['skills', 'agent-device'],
    outputPublishers: ['blob', 'file'],
    mobileDefaults: {
      platform,
    },
    extraInstructions: [
      `This is a local ${platform} QA run. Keep the flow lightweight and focus on the highest-signal UI paths.`,
    ],
  }
}

function getCommandDefaults(
  commandId: CommandId,
  options: {
    localPlatform?: CaliPlatform
    ciProvider?: CiProvider
  }
): CaliCommandConfig {
  const { localPlatform, ciProvider } = options
  const commonOutputPublishers: PublisherName[] = ['file']
  const mobileOutputPublishers: PublisherName[] = ['blob', 'file']

  switch (commandId) {
    case 'qa':
      if (ciProvider === 'eas') {
        return {
          ...MOBILE_CI_QA_DEFAULTS,
          extraInstructions: [
            ...asArray(MOBILE_CI_QA_DEFAULTS.extraInstructions),
            'This run is expected to execute in EAS-style CI with runtime context derived before the agent starts.',
          ],
        }
      }

      if (ciProvider === 'github-actions') {
        return { ...MOBILE_CI_QA_DEFAULTS }
      }

      return createLocalQaDefaults(localPlatform ?? 'android')
    case 'perf-review':
      if (ciProvider) {
        return {
          enabledToolPacks: ['skills', 'agent-device', 'react-devtools', 'repo-read'],
          outputPublishers: mobileOutputPublishers,
          extraInstructions: [
            'Focus on high-signal runtime performance evidence such as rerenders, slow interactions, and component-level bottlenecks.',
          ],
        }
      }

      return {
        enabledToolPacks: ['skills', 'agent-device', 'react-devtools', 'repo-read'],
        outputPublishers: mobileOutputPublishers,
        mobileDefaults: {
          platform: localPlatform ?? 'android',
        },
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
      throw new Error(`Cali config file does not exist: ${configFilePath}`)
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
  const { commandId, cwd, configPath, localPlatform, ciProvider, model } = options
  const fileConfig = await loadCaliConfigFile(cwd, configPath)
  const resolvedLocalPlatform =
    ciProvider != null ? undefined : (localPlatform ?? resolveDefaultLocalPlatform(commandId))
  const envDefaults = getCommandDefaults(commandId, {
    localPlatform: resolvedLocalPlatform,
    ciProvider,
  })
  const commandConfig = getCommandConfig(fileConfig, COMMAND_CONFIG_KEYS[commandId])
  const merged = mergeCommandConfig(envDefaults, commandConfig)

  return {
    workspaceRoot: fileConfig.workspaceRoot
      ? resolveFromCwd(cwd, fileConfig.workspaceRoot)
      : undefined,
    contextPath: merged.contextPath ? resolveFromCwd(cwd, merged.contextPath) : undefined,
    skillPaths: uniqueStrings([
      ...(fileConfig.skillPaths ?? []).map((skillPath) => resolveFromCwd(cwd, skillPath)),
      ...getBuiltInSkillPaths(cwd),
    ]),
    enabledToolPacks: merged.enabledToolPacks ?? [],
    outputPublishers: merged.outputPublishers ?? ['file'],
    extraInstructions: asArray(merged.extraInstructions),
    model:
      model ?? merged.model ?? fileConfig.model ?? process.env.QA_MODEL ?? 'openai/gpt-5.4-mini',
    mobileDefaults: merged.mobileDefaults ?? {},
  }
}
