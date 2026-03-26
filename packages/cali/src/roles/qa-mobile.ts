import { createGateway, ToolLoopAgent, gateway, stepCountIs, tool } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

import type { QaRuntimeContext } from '../env/types.js'
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
  skillPaths: string[]
  enabledToolPacks: string[]
  extraInstructions: string[]
  prompt?: string
}

type QaMobileRoleResult = {
  reportInput: QaReportInput
  agentDeviceTrace: AgentDeviceTraceEntry[]
  skills: SkillMetadata[]
}

const EMPTY_INPUT_SCHEMA = z.object({})
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

function buildModel(modelId: string) {
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.AI_GATEWAY_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY
  const anthropicAuthToken = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.CLAUDE_AUTH_TOKEN
  const runningOnVercel = Boolean(
    process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_OIDC_TOKEN
  )

  if (gatewayApiKey || runningOnVercel) {
    const provider = gatewayApiKey ? createGateway({ apiKey: gatewayApiKey }) : gateway
    return provider(modelId)
  }

  if (anthropicApiKey || anthropicAuthToken) {
    const anthropic = createAnthropic({
      ...(anthropicApiKey ? { apiKey: anthropicApiKey } : {}),
      ...(anthropicAuthToken ? { authToken: anthropicAuthToken } : {}),
    })

    const anthropicModelId = modelId.startsWith('anthropic/')
      ? modelId.slice('anthropic/'.length)
      : modelId

    return anthropic(anthropicModelId)
  }

  throw new Error(
    'Missing AI credentials. Set AI_GATEWAY_API_KEY (or AI_GATEWAY_KEY), or ANTHROPIC_API_KEY / CLAUDE_API_KEY.'
  )
}

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

export async function runQaMobileRole(options: RunQaMobileRoleOptions): Promise<QaMobileRoleResult> {
  const { context, modelId, skillPaths, enabledToolPacks, extraInstructions, prompt } = options
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
    Object.assign(tools, createAgentDeviceToolPack({ trace: agentDeviceTrace }))
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
    'Take screenshots for meaningful states and keep filenames short and descriptive.',
    'If the environment is broken or a prerequisite is missing, report blocked checks instead of guessing.',
    'If the evidence is visual but not conclusive from text automation, prefer overallStatus "unsure".',
    'Do not finish with plain text. Finish only by calling write_report exactly once.',
  ]
    .concat(extraInstructions)
    .join(' ')

  const agent = new ToolLoopAgent({
    model: buildModel(modelId),
    instructions,
    tools,
    toolChoice: 'required',
    stopWhen: stepCountIs(12),
    prepareStep: async ({ steps, stepNumber }) => {
      const hasWrittenReport = hasToolActivity(steps, 'write_report')
      const hasUsedDeviceTools = hasToolActivity(steps, 'agent_device')

      if (hasWrittenReport || !hasUsedDeviceTools || stepNumber < 6) {
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
  })

  if (!reportInput) {
    reportInput = {
      overallStatus: 'blocked',
      summary: result.text || 'The agent completed without calling write_report.',
      checked: ['Produce a mobile QA report'],
      issues: ['The write_report tool was not called by the agent.'],
      nextSteps: ['Inspect the run logs and tighten the QA role instructions.'],
    }
  }

  return {
    reportInput,
    agentDeviceTrace,
    skills,
  }
}
