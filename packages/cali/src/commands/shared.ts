import path from 'node:path'

import { tool } from 'ai'
import { z } from 'zod'

import { loadCommandConfig, resolveDefaultEnvName } from '../config/load.js'
import type { ToolPackName } from '../config/schema.js'
import type { CommandReport } from '../report/types.js'
import { buildCiContext } from '../runtime/ci-context.js'
import { resolveCommandContext } from '../runtime/context.js'
import {
  bootstrapMobileApp,
  closeAgentDeviceSession,
  createAgentDeviceSessionName,
  prepareMobileOutputDirectories,
  resolveMobileRuntimeContext,
} from '../runtime/mobile.js'
import { publishReport } from '../runtime/publishers.js'
import { prepareToolPacks } from '../runtime/tool-packs.js'
import type {
  CaliContext,
  CommandCliOptions,
  CommandId,
  CommandResolvedConfig,
  MobileCommandRuntimeContext,
  ToolTraceEntry,
} from '../runtime/types.js'
import { resolveFromCwd } from '../utils.js'

type AgentProgressEvent = {
  stepNumber: number
  finishReason: string
  toolNames: string[]
  totalTokens?: number
}

type AgentFinishEvent = {
  stepCount: number
  finishReason: string
  totalTokens?: number
}

type RoleRunArgs = {
  context: CaliContext
  modelId: string
  tools: Record<string, any>
  availableSkillsPrompt: string
  preloadedSkillsPrompt: string
  extraInstructions: string[]
  prompt?: string
  onAgentStep?: (event: AgentProgressEvent) => void
  onAgentFinish?: (event: AgentFinishEvent) => void
}

type RunStructuredCommandOptions<TReportInput, TReport extends CommandReport> = {
  commandId: CommandId
  cli: CommandCliOptions
  roleLabel: string
  reportLabel: string
  createBlockedReport: (summary: string) => TReportInput
  composeReport: (args: {
    model: string
    context: CaliContext
    reportInput: TReportInput
  }) => TReport
  runRole: (args: RoleRunArgs) => Promise<{ reportInput: TReportInput }>
  getEnabledToolPacks?: (args: {
    context: CaliContext
    config: CommandResolvedConfig
  }) => ToolPackName[]
}

export function printPhase(title: string, detail?: string) {
  console.log(detail ? `${title}: ${detail}` : title)
}

export function summarizeReason(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
}

export function formatAgentStepDetail(event: AgentProgressEvent) {
  const details = [`step ${event.stepNumber}`, `finish=${event.finishReason}`]

  if (event.toolNames.length > 0) {
    details.push(`tools=${event.toolNames.join(',')}`)
  }

  if (event.totalTokens != null) {
    details.push(`tokens=${event.totalTokens}`)
  }

  return details.join(' | ')
}

export function formatAgentFinishDetail(event: AgentFinishEvent) {
  const details = [`steps=${event.stepCount}`, `finish=${event.finishReason}`]

  if (event.totalTokens != null) {
    details.push(`tokens=${event.totalTokens}`)
  }

  return details.join(' | ')
}

export async function loadRunContext(commandId: CommandId, cli: CommandCliOptions) {
  const cwd = process.cwd()
  printPhase('Resolving config')

  const config = await loadCommandConfig({
    commandId,
    cwd,
    configPath: cli.configPath,
    envName: cli.envName,
    model: cli.model,
  })
  const injectedContext = cli.ciProvider
    ? await buildCiContext(cwd, cli.ciProvider, {
        workspaceRoot: cli.workspaceRoot,
        platform: cli.platform,
        artifactPath: cli.artifactPath,
        appId: cli.appId,
        deviceName: cli.deviceName,
        outputDir: cli.outputDir,
        buildId: cli.buildId,
        workflowUrl: cli.workflowUrl,
        logsUrl: cli.logsUrl,
      })
    : {}
  const context = await resolveCommandContext(commandId, cwd, config, cli, injectedContext)

  return {
    cwd,
    config,
    context,
  }
}

function createFallbackConfig(
  commandId: CommandId,
  cwd: string,
  cli: CommandCliOptions
): CommandResolvedConfig {
  return {
    envName: cli.envName ?? resolveDefaultEnvName(commandId, cli.ciProvider),
    workspaceRoot: cli.workspaceRoot ? resolveFromCwd(cwd, cli.workspaceRoot) : cwd,
    contextPath: undefined,
    skillPaths: [],
    enabledToolPacks: [],
    outputPublishers: ['file'],
    extraInstructions: [],
    model: cli.model ?? process.env.QA_MODEL ?? 'openai/gpt-5.4-mini',
    mobileDefaults: {},
  }
}

function createFallbackContext(
  commandId: 'qa' | 'perf-review',
  cwd: string,
  config: CommandResolvedConfig,
  cli: CommandCliOptions
): CaliContext {
  const workspaceRoot = config.workspaceRoot ?? cwd
  const outputDir = resolveFromCwd(
    workspaceRoot,
    cli.outputDir ?? path.join('artifacts', commandId)
  )
  const platform =
    cli.platform ??
    config.mobileDefaults.platform ??
    (config.envName === 'local-ios' ? 'ios' : undefined)

  return {
    workspaceRoot,
    repository: undefined,
    task:
      cli.taskId || cli.taskTitle || cli.taskBody || cli.taskUrl
        ? {
            id: cli.taskId,
            title: cli.taskTitle,
            body: cli.taskBody,
            url: cli.taskUrl,
            labels: [],
          }
        : undefined,
    pullRequest:
      cli.prNumber || cli.prTitle || cli.prBody || cli.prUrl || cli.prBaseBranch || cli.prHeadBranch
        ? {
            number: cli.prNumber,
            title: cli.prTitle,
            body: cli.prBody,
            url: cli.prUrl,
            labels: [],
            isDraft: false,
            baseBranch: cli.prBaseBranch,
            headBranch: cli.prHeadBranch,
          }
        : undefined,
    mobile: {
      platform,
      artifactPath: cli.artifactPath,
      appId: cli.appId,
      deviceName: cli.deviceName ?? config.mobileDefaults.deviceName,
    },
    build:
      cli.buildId || cli.workflowUrl || cli.logsUrl
        ? {
            id: cli.buildId,
            workflowUrl: cli.workflowUrl,
            logsUrl: cli.logsUrl,
          }
        : undefined,
    output: {
      outputDir,
      screenshotsDir: path.join(outputDir, 'screenshots'),
    },
    qa: commandId === 'qa' ? { acceptanceCriteria: [] } : undefined,
    perfReview:
      commandId === 'perf-review'
        ? {
            profilingGoals: [],
            suspectedScreens: [],
          }
        : undefined,
    dev: undefined,
  }
}

export function createRunContextTool(commandId: CommandId, context: CaliContext) {
  return tool({
    description: `Read the normalized ${commandId} run context and metadata.`,
    inputSchema: z.object({}),
    execute: async () => context,
  })
}

export function printFinalReport(
  cwd: string,
  commandId: CommandId,
  reportLabel: string,
  report: CommandReport
) {
  console.log(
    `${reportLabel} written to ${resolveFromCwd(
      cwd,
      path.join(report.context.output.outputDir ?? path.join('artifacts', commandId), 'section.md')
    )}`
  )

  const reason = summarizeReason(report.summary)
  console.log(
    reason
      ? `Overall status: ${report.overallStatus} (${reason})`
      : `Overall status: ${report.overallStatus}`
  )
}

export async function runStructuredCommand<TReportInput, TReport extends CommandReport>(
  options: RunStructuredCommandOptions<TReportInput, TReport>
) {
  const {
    commandId,
    cli,
    roleLabel,
    reportLabel,
    createBlockedReport,
    composeReport,
    runRole,
    getEnabledToolPacks,
  } = options
  const { cwd, config, context } = await loadRunContext(commandId, cli)

  let reportInput: TReportInput

  try {
    const enabledToolPacks = getEnabledToolPacks?.({ context, config }) ?? config.enabledToolPacks

    printPhase('Preparing tool packs', enabledToolPacks.join(', '))
    const toolPacks = await prepareToolPacks({
      context,
      skillPaths: config.skillPaths,
      enabledToolPacks,
    })

    printPhase(`Running ${roleLabel} agent`, config.model)
    const result = await runRole({
      context,
      modelId: config.model,
      tools: {
        ...toolPacks.tools,
        get_run_context: createRunContextTool(commandId, context),
      },
      availableSkillsPrompt: toolPacks.availableSkillsPrompt,
      preloadedSkillsPrompt: toolPacks.preloadedSkillsPrompt,
      extraInstructions: config.extraInstructions,
      prompt: cli.prompt,
      onAgentStep: (event) => {
        printPhase(`${roleLabel} agent step complete`, formatAgentStepDetail(event))
      },
      onAgentFinish: (event) => {
        printPhase(`${roleLabel} agent finished`, formatAgentFinishDetail(event))
      },
    })

    reportInput = result.reportInput
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
    printPhase('Run blocked', summarizeReason(error.message))
    reportInput = createBlockedReport(error.message)
  }

  const report = composeReport({
    model: config.model,
    context,
    reportInput,
  })

  printPhase('Publishing report', config.outputPublishers.join(', '))
  const publishedReport = await publishReport({
    report,
    publishers: config.outputPublishers,
  })

  printFinalReport(cwd, commandId, reportLabel, publishedReport)
}

type MobileRoleRunArgs = RoleRunArgs & {
  mobileContext: MobileCommandRuntimeContext
}

type RunMobileStructuredCommandOptions<TReportInput, TReport extends CommandReport> = {
  commandId: 'qa' | 'perf-review'
  cli: CommandCliOptions
  roleLabel: string
  reportLabel: string
  createBlockedReport: (summary: string) => TReportInput
  composeReport: (args: {
    model: string
    context: CaliContext
    reportInput: TReportInput
    mobileContext?: MobileCommandRuntimeContext
    traces: {
      agentDeviceTrace: ToolTraceEntry[]
      reactDevtoolsTrace: ToolTraceEntry[]
    }
  }) => Promise<TReport> | TReport
  runRole: (args: MobileRoleRunArgs) => Promise<{ reportInput: TReportInput }>
}

export async function runMobileStructuredCommand<TReportInput, TReport extends CommandReport>(
  options: RunMobileStructuredCommandOptions<TReportInput, TReport>
) {
  const { commandId, cli, roleLabel, reportLabel, createBlockedReport, composeReport, runRole } =
    options
  const cwd = process.cwd()
  let config: CommandResolvedConfig | undefined
  let context: CaliContext | undefined

  let reportInput: TReportInput
  let mobileContext: MobileCommandRuntimeContext | undefined
  let sessionName: string | undefined
  let traces: {
    agentDeviceTrace: ToolTraceEntry[]
    reactDevtoolsTrace: ToolTraceEntry[]
  } = {
    agentDeviceTrace: [],
    reactDevtoolsTrace: [],
  }

  try {
    const loaded = await loadRunContext(commandId, cli)
    config = loaded.config
    context = loaded.context

    mobileContext = await resolveMobileRuntimeContext(commandId, config.envName, context)
    sessionName = createAgentDeviceSessionName(mobileContext.platform)

    printPhase(
      'Preparing output',
      `${mobileContext.platform} | ${mobileContext.deviceName ?? 'bound device'} | ${mobileContext.appId}`
    )
    await prepareMobileOutputDirectories(mobileContext)

    printPhase('Bootstrapping app', mobileContext.artifactPath)
    await bootstrapMobileApp(commandId, config.envName, mobileContext, sessionName)
    printPhase('Bootstrap complete')

    printPhase('Preparing tool packs', config.enabledToolPacks.join(', '))
    const preparedToolPacks = await prepareToolPacks({
      context,
      skillPaths: config.skillPaths,
      enabledToolPacks: config.enabledToolPacks,
      sessionName,
    })
    traces = preparedToolPacks.traces

    printPhase(`Running ${roleLabel} agent`, config.model)
    const result = await runRole({
      context,
      mobileContext,
      modelId: config.model,
      tools: {
        ...preparedToolPacks.tools,
        get_run_context: createRunContextTool(commandId, context),
      },
      availableSkillsPrompt: preparedToolPacks.availableSkillsPrompt,
      preloadedSkillsPrompt: preparedToolPacks.preloadedSkillsPrompt,
      extraInstructions: config.extraInstructions,
      prompt: cli.prompt,
      onAgentStep: (event) => {
        printPhase(`${roleLabel} step complete`, formatAgentStepDetail(event))
      },
      onAgentFinish: (event) => {
        printPhase(`${roleLabel} agent finished`, formatAgentFinishDetail(event))
      },
    })

    reportInput = result.reportInput
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
    printPhase('Run blocked', summarizeReason(error.message))
    reportInput = createBlockedReport(error.message)
  } finally {
    if (sessionName) {
      await closeAgentDeviceSession(sessionName)
    }
  }

  const resolvedConfig = config ?? createFallbackConfig(commandId, cwd, cli)
  const resolvedContext = context ?? createFallbackContext(commandId, cwd, resolvedConfig, cli)
  const report = await composeReport({
    model: resolvedConfig.model,
    context: resolvedContext,
    reportInput,
    mobileContext,
    traces,
  })

  const outputPublishers = Array.from(
    new Set<CommandResolvedConfig['outputPublishers'][number]>([
      'file',
      ...resolvedConfig.outputPublishers,
    ])
  )
  printPhase('Publishing report', outputPublishers.join(', '))
  const publishedReport = await publishReport({
    report,
    publishers: outputPublishers,
  })

  printFinalReport(cwd, commandId, reportLabel, publishedReport)
}
