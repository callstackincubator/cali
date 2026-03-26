import type {
  EnvironmentAdapterName,
  PublisherName,
  QaPresetName,
  ToolPackName,
} from '../config/schema.js'

export type QaPlatform = 'android' | 'ios'

export type QaMetadata = {
  prNumber?: number
  prTitle?: string
  prBody?: string | null
  prLabels: string[]
  isDraft: boolean
  taskId?: string
  taskTitle?: string
  taskBody?: string
}

export type QaRuntimeContext = {
  platform: QaPlatform
  artifactPath: string
  appId: string
  buildId: string
  workflowUrl: string
  outputDir: string
  screenshotsDir: string
  deviceName?: string
  metadata: QaMetadata
}

export type QaCliOptions = {
  presetName?: QaPresetName
  configPath?: string
  prompt?: string
  jsonPath?: string
  platform?: QaPlatform
  artifactPath?: string
  appId?: string
  deviceName?: string
  outputDir?: string
  buildId?: string
  workflowUrl?: string
  prNumber?: number
  prTitle?: string
  prBody?: string
  taskId?: string
  taskTitle?: string
  taskBody?: string
  model?: string
}

export type QaResolvedConfig = {
  environmentAdapter: EnvironmentAdapterName
  appId?: string
  platformDefaults: {
    platform?: QaPlatform
    deviceName?: string
  }
  outputDir?: string
  skillPaths: string[]
  enabledToolPacks: ToolPackName[]
  outputPublishers: PublisherName[]
  extraInstructions: string[]
  model: string
}
