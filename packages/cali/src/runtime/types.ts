import type { CaliEnvName, PublisherName, ToolPackName } from '../config/schema.js'
export type { CommandId } from '../config/schema.js'
export type CommandConfigKey = 'qa' | 'review' | 'perfReview' | 'dev'

export type CaliPlatform = 'android' | 'ios'

export type RepositoryContext = {
  provider?: string
  owner?: string
  name?: string
  cloneUrl?: string
  defaultBranch?: string
  currentBranch?: string
  commitSha?: string
}

export type TaskContext = {
  provider?: string
  id?: string
  title?: string
  body?: string | null
  url?: string
  labels: string[]
}

export type PullRequestContext = {
  number?: number
  title?: string
  body?: string | null
  url?: string
  labels: string[]
  isDraft: boolean
  baseBranch?: string
  headBranch?: string
  diffPath?: string
  diffSummary?: string
}

export type MobileContext = {
  platform?: CaliPlatform
  artifactPath?: string
  appId?: string
  deviceName?: string
}

export type BuildContext = {
  id?: string
  workflowUrl?: string
  logsUrl?: string
}

export type OutputContext = {
  outputDir?: string
  screenshotsDir?: string
}

export type QaCommandContext = {
  acceptanceCriteria: string[]
}

export type ReviewCommandContext = Record<string, never>

export type PerfReviewCommandContext = {
  targetFlow?: string
  expectedInteraction?: string
  profilingGoals: string[]
  suspectedScreens: string[]
}

export type DevCommandContext = {
  branchStrategy?: string
  allowedValidations: string[]
  writePolicy?: 'workspace' | 'none'
  pushPolicy?: 'disabled' | 'manual' | 'auto'
}

export type CaliContext = {
  workspaceRoot: string
  repository?: RepositoryContext
  task?: TaskContext
  pullRequest?: PullRequestContext
  mobile?: MobileContext
  build?: BuildContext
  output: OutputContext
  qa?: QaCommandContext
  review?: ReviewCommandContext
  perfReview?: PerfReviewCommandContext
  dev?: DevCommandContext
}

export type MobileCommandRuntimeContext = {
  platform: CaliPlatform
  artifactPath: string
  appId: string
  deviceName?: string
  outputDir: string
  screenshotsDir: string
}

export type CommandCliOptions = {
  envName?: CaliEnvName
  configPath?: string
  prompt?: string
  contextPath?: string
  outputDir?: string
  model?: string
  workspaceRoot?: string
  platform?: CaliPlatform
  artifactPath?: string
  appId?: string
  deviceName?: string
  buildId?: string
  workflowUrl?: string
  logsUrl?: string
  prNumber?: number
  prTitle?: string
  prBody?: string
  prUrl?: string
  prBaseBranch?: string
  prHeadBranch?: string
  taskId?: string
  taskTitle?: string
  taskBody?: string
  taskUrl?: string
}

export type CommandResolvedConfig = {
  envName: CaliEnvName
  workspaceRoot?: string
  contextPath?: string
  skillPaths: string[]
  enabledToolPacks: ToolPackName[]
  outputPublishers: PublisherName[]
  extraInstructions: string[]
  model: string
  mobileDefaults: {
    platform?: CaliPlatform
    deviceName?: string
    appId?: string
  }
}

export type ToolTraceEntry = {
  command: string
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
}
