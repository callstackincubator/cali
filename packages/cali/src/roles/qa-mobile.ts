import { generateText, Output, stepCountIs, tool, ToolLoopAgent } from 'ai'
import { z } from 'zod'

import type { QaRuntimeContext } from '../env/types.js'
import { createQaAgentModel } from '../model.js'
import type { AgentDeviceTraceEntry, QaReportInput } from '../report/types.js'
import { createAgentDeviceToolPack } from '../tools/agent-device.js'
import {
  buildSkillsPrompt,
  createSkillsToolPack,
  discoverSkills,
  type SkillMetadata,
} from '../tools/skills.js'

type RunQaMobileRoleOptions = {
  context: QaRuntimeContext
  modelId: string
  sessionName: string
  skillPaths: string[]
  enabledToolPacks: string[]
  extraInstructions: string[]
  prompt?: string
  onAgentStep?: (event: {
    stepNumber: number
    finishReason: string
    toolNames: string[]
    totalTokens?: number
  }) => void
  onAgentFinish?: (event: { stepCount: number; finishReason: string; totalTokens?: number }) => void
}

type QaMobileRoleResult = {
  reportInput: QaReportInput
  agentDeviceTrace: AgentDeviceTraceEntry[]
}

const EMPTY_INPUT_SCHEMA = z.object({})
const MAX_AGENT_STEPS = 12
const REPORT_BUFFER_STEPS = 2
const WRITE_REPORT_INPUT_SCHEMA = z.object({
  overallStatus: z.enum(['passed', 'failed', 'blocked', 'not_tested', 'unsure']),
  summary: z.string(),
  checked: z.array(z.string()).optional(),
  issues: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  screenshotLabels: z
    .array(
      z.object({
        fileName: z.string(),
        label: z.string(),
      })
    )
    .optional(),
})

function buildPrompt(
  context: QaRuntimeContext,
  skills: SkillMetadata[],
  extraInstructions: string[],
  prompt?: string
) {
  const platformLabel = context.platform === 'ios' ? 'iOS' : 'Android'
  const baseInstructions = [
    `Review this ${platformLabel} build and run a lightweight QA pass.`,
    '',
    'Execution context:',
    `- Platform: ${platformLabel}`,
    `- Build path: ${context.artifactPath}`,
    `- Application id: ${context.appId}`,
    `- Build ID: ${context.buildId || 'n/a'}`,
    `- Workflow URL: ${context.workflowUrl || 'n/a'}`,
    `- Device: ${context.deviceName || 'currently bound device'}`,
    `- Screenshot directory: ${context.screenshotsDir}`,
    '',
    context.metadata.prTitle
      ? `PR #${context.metadata.prNumber || 'n/a'}: ${context.metadata.prTitle}`
      : 'No pull request title was provided.',
    context.metadata.prBody || 'No pull request body was provided.',
    '',
    buildSkillsPrompt(skills),
  ]

  if (extraInstructions.length > 0) {
    baseInstructions.push('', 'Extra instructions:')
    for (const instruction of extraInstructions) {
      baseInstructions.push(`- ${instruction}`)
    }
  }

  if (prompt?.trim()) {
    baseInstructions.push('', 'Task-specific focus:')
    baseInstructions.push(prompt.trim())
  }

  baseInstructions.push(
    '',
    `Save screenshots into ${context.screenshotsDir}/*.png with short descriptive filenames.`,
    'When text visibility matters, prefer a plain snapshot over image-heavy inspection.',
    'Use canonical agent-device commands like back or home directly. Do not emulate navigation with press.',
    'Treat bootstrap as already handled. Do not install, reinstall, or open the app yourself.',
    'Do not inspect repository source files or modify project code.',
    'Finish by calling write_report exactly once.'
  )

  return baseInstructions.join('\n')
}

function hasToolActivity(
  steps: Array<{
    toolCalls?: Array<{ toolName?: string }>
    toolResults?: Array<{ toolName?: string }>
  }>,
  toolName: string
) {
  return steps.some((step) => {
    const hasToolCall = step.toolCalls?.some((toolCall) => toolCall.toolName === toolName)
    const hasToolResult = step.toolResults?.some((toolResult) => toolResult.toolName === toolName)

    return Boolean(hasToolCall || hasToolResult)
  })
}

async function synthesizeReportInput(
  modelId: string,
  context: QaRuntimeContext,
  agentDeviceTrace: AgentDeviceTraceEntry[],
  extraInstructions: string[],
  prompt?: string
) {
  const evidence = {
    taskPrompt: prompt ?? '',
    platform: context.platform,
    appId: context.appId,
    buildId: context.buildId,
    workflowUrl: context.workflowUrl,
    screenshotsDir: context.screenshotsDir,
    agentDeviceTrace,
  }

  const { output } = await generateText({
    model: createQaAgentModel(modelId),
    output: Output.object({
      schema: WRITE_REPORT_INPUT_SCHEMA,
      name: 'qa_report',
      description: 'Structured QA result for a completed mobile QA run.',
    }),
    prompt: [
      'Produce the final QA report for a completed mobile QA run.',
      'Base the report only on the provided evidence. Do not invent actions, screenshots, or observations.',
      'If the evidence shows the requested behavior worked, set overallStatus to "passed".',
      'If the evidence is inconclusive, set overallStatus to "unsure".',
      'If the environment was broken, set overallStatus to "blocked".',
      prompt?.trim() ? `Task-specific focus:\n${prompt.trim()}` : '',
      extraInstructions.length > 0
        ? `Extra instructions:\n${extraInstructions.map((instruction) => `- ${instruction}`).join('\n')}`
        : '',
      `Evidence:\n${JSON.stringify(evidence, null, 2)}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  })

  return output satisfies QaReportInput
}

export async function runQaMobileRole(
  options: RunQaMobileRoleOptions
): Promise<QaMobileRoleResult> {
  const {
    context,
    modelId,
    sessionName,
    skillPaths,
    enabledToolPacks,
    extraInstructions,
    prompt,
    onAgentStep,
    onAgentFinish,
  } = options
  const skills = await discoverSkills(skillPaths)
  const agentDeviceTrace: AgentDeviceTraceEntry[] = []
  let reportInput: QaReportInput | undefined

  const tools: Record<string, any> = {
    get_run_context: tool({
      description: 'Read the normalized QA run context and metadata.',
      inputSchema: EMPTY_INPUT_SCHEMA,
      execute: async () => context,
    }),
  }

  if (enabledToolPacks.includes('skills')) {
    Object.assign(tools, createSkillsToolPack(skills))
  }

  if (enabledToolPacks.includes('agent-device')) {
    Object.assign(tools, createAgentDeviceToolPack({ trace: agentDeviceTrace, sessionName }))
  }

  tools.write_report = tool({
    description: 'Persist the final QA summary, findings, and screenshot labels.',
    inputSchema: WRITE_REPORT_INPUT_SCHEMA,
    execute: async (input) => {
      if (reportInput) {
        throw new Error('write_report has already been called for this QA run.')
      }

      reportInput = input satisfies QaReportInput
      return {
        ok: true,
      }
    },
  })

  const instructions = [
    `You are a mobile QA agent for ${context.platform === 'ios' ? 'iOS' : 'Android'} builds.`,
    'Use only the provided tool packs and evidence from their results.',
    'The CLI already handled deterministic bootstrap. Never install, reinstall, or open the app.',
    'Refresh your view with snapshot-style commands after every meaningful UI transition.',
    'Use canonical agent-device commands like back or home directly. Do not emulate them with press.',
    'Take screenshots for meaningful states and keep filenames short and descriptive.',
    'If the environment is broken or a prerequisite is missing, report blocked checks instead of guessing.',
    'If the evidence is visual but not conclusive from text automation, prefer overallStatus "unsure".',
    'Do not finish with plain text. Finish only by calling write_report exactly once.',
  ]
    .concat(extraInstructions)
    .join(' ')

  const agent = new ToolLoopAgent({
    model: createQaAgentModel(modelId),
    instructions,
    tools,
    toolChoice: 'required',
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    onFinish: async ({ steps, finishReason, totalUsage }) => {
      onAgentFinish?.({
        stepCount: steps.length,
        finishReason,
        totalTokens: totalUsage.totalTokens,
      })
    },
    prepareStep: async ({ steps, stepNumber }) => {
      const hasWrittenReport = hasToolActivity(steps, 'write_report')
      const hasUsedDeviceTools = hasToolActivity(steps, 'agent_device')

      // Reserve the final steps for report emission if the model keeps exploring.
      if (
        hasWrittenReport ||
        !hasUsedDeviceTools ||
        stepNumber < MAX_AGENT_STEPS - REPORT_BUFFER_STEPS
      ) {
        return {}
      }

      return {
        activeTools: ['write_report'],
        toolChoice: { type: 'tool', toolName: 'write_report' },
      }
    },
  })

  const result = await agent.generate({
    prompt: buildPrompt(context, skills, extraInstructions, prompt),
    onStepFinish: async ({ stepNumber, finishReason, toolCalls, usage }) => {
      onAgentStep?.({
        stepNumber: stepNumber + 1,
        finishReason,
        toolNames: toolCalls.map((toolCall) => toolCall.toolName),
        totalTokens: usage.totalTokens,
      })
    },
  })

  if (!reportInput) {
    try {
      reportInput = await synthesizeReportInput(
        modelId,
        context,
        agentDeviceTrace,
        extraInstructions,
        prompt
      )
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))

      reportInput = {
        overallStatus: 'blocked',
        summary: result.text || 'The agent completed without calling write_report.',
        checked: ['Produce a mobile QA report'],
        issues: [
          'The write_report tool was not called by the agent.',
          `Fallback report synthesis failed: ${error.message}`,
        ],
        nextSteps: ['Inspect the run logs and tighten the QA role instructions.'],
      }
    }
  }

  return {
    reportInput,
    agentDeviceTrace,
  }
}
