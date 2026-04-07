import path from 'node:path'

import { tool } from 'ai'
import { z } from 'zod'

import { loadCommandConfig } from '../config/load.js'
import type { ToolPackName } from '../config/schema.js'
import type { CommandReport } from '../report/types.js'
import { resolveCommandContext } from '../runtime/context.js'
import { publishReport } from '../runtime/publishers.js'
import { prepareToolPacks } from '../runtime/tool-packs.js'
import type {
  CaliContext,
  CommandCliOptions,
  CommandId,
  CommandResolvedConfig,
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
  const context = await resolveCommandContext(commandId, cwd, config, cli)

  return {
    cwd,
    config,
    context,
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
