import { z } from 'zod'

import type { QaReportInput } from '../report/types.js'
import { runToolLoopRole } from '../runtime/tool-loop-role.js'
import type { CaliContext } from '../runtime/types.js'

type RunQaMobileRoleOptions = {
  context: CaliContext
  modelId: string
  tools: Record<string, any>
  availableSkillsPrompt: string
  preloadedSkillsPrompt: string
  extraInstructions: string[]
  prompt?: string
  acceptanceCriteriaUsed: string[]
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
}

function createMissingQaReport(): QaReportInput {
  return {
    overallStatus: 'blocked',
    summary: 'The agent completed without calling write_report.',
    checked: ['Produce a mobile QA report'],
    issues: ['The write_report tool was not called by the agent.'],
    nextSteps: ['Inspect the run logs and tighten the QA role instructions.'],
    environmentNotes: ['The write_report tool was not called by the agent.'],
  }
}

const WRITE_REPORT_INPUT_SCHEMA = z.object({
  overallStatus: z.enum(['passed', 'failed', 'blocked', 'not_tested', 'unsure']),
  summary: z.string(),
  checked: z.array(z.string()).optional(),
  issues: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  environmentNotes: z.array(z.string()).optional(),
})

function buildPrompt(
  context: CaliContext,
  acceptanceCriteriaUsed: string[],
  availableSkillsPrompt: string,
  preloadedSkillsPrompt: string,
  extraInstructions: string[],
  prompt?: string
) {
  const platformLabel = context.mobile?.platform === 'ios' ? 'iOS' : 'Android'
  const lines = [
    `Review this ${platformLabel} build and run a lightweight QA pass.`,
    '',
    'Execution context:',
    `- Platform: ${platformLabel}`,
    `- Build path: ${context.mobile?.artifactPath ?? 'n/a'}`,
    `- Application id: ${context.mobile?.appId ?? 'n/a'}`,
    `- Build ID: ${context.build?.id ?? 'n/a'}`,
    `- Workflow URL: ${context.build?.workflowUrl ?? 'n/a'}`,
    `- Device: ${context.mobile?.deviceName ?? 'currently bound device'}`,
    `- Screenshot directory: ${context.output.screenshotsDir ?? 'n/a'}`,
    '',
    `Pull request: ${context.pullRequest?.title ?? 'n/a'}`,
    context.pullRequest?.body ?? 'No pull request body was provided.',
    '',
    `Task: ${context.task?.title ?? 'n/a'}`,
    context.task?.body ?? 'No task body was provided.',
    '',
    'Acceptance criteria used:',
    ...acceptanceCriteriaUsed.map((criterion) => `- ${criterion}`),
    '',
    preloadedSkillsPrompt,
    '',
    availableSkillsPrompt,
  ]

  if (extraInstructions.length > 0) {
    lines.push('', 'Extra instructions:')
    for (const instruction of extraInstructions) {
      lines.push(`- ${instruction}`)
    }
  }

  if (prompt?.trim()) {
    lines.push('', 'Task-specific focus:')
    lines.push(prompt.trim())
  }

  lines.push(
    '',
    `Save screenshots into ${context.output.screenshotsDir ?? 'the screenshots directory'}/*.png with short descriptive filenames that describe the current visible state.`,
    'Name screenshot files after observed state, not intended step labels. For example, use counter-0-before-increment.png only after verifying the counter is visibly 0.',
    'When text visibility matters, prefer a plain snapshot over image-heavy inspection.',
    'Do not use agent-device session management commands such as session list, session close, or session open.',
    'Use canonical agent-device commands like back or home directly. Do not emulate navigation with press.',
    'Treat bootstrap as already handled. Do not install, reinstall, or open the app yourself.',
    'Do not inspect repository source files or modify project code.',
    'Finish by calling write_report exactly once.'
  )

  return lines.join('\n')
}

export async function runQaMobileRole(
  options: RunQaMobileRoleOptions
): Promise<QaMobileRoleResult> {
  const {
    context,
    modelId,
    tools,
    availableSkillsPrompt,
    preloadedSkillsPrompt,
    extraInstructions,
    prompt,
    acceptanceCriteriaUsed,
    onAgentStep,
    onAgentFinish,
  } = options

  const instructions = [
    `You are a mobile QA agent for ${context.mobile?.platform === 'ios' ? 'iOS' : 'Android'} builds.`,
    'Use only the provided tool packs and evidence from their results.',
    'The CLI already handled deterministic bootstrap. Never install, reinstall, or open the app.',
    'Refresh your view with snapshot-style commands after every meaningful UI transition.',
    'Do not spend steps on session management commands such as session list, session close, or session open.',
    'Use canonical agent-device commands like back or home directly. Do not emulate them with press.',
    'Take screenshots for meaningful states and keep filenames short, descriptive, and faithful to the visible state at capture time.',
    'If the environment is broken or a prerequisite is missing, report blocked checks instead of guessing.',
    'If the evidence is visual but not conclusive from text automation, prefer overallStatus "unsure".',
    'Do not finish with plain text. Finish only by calling write_report exactly once.',
  ]
    .concat(extraInstructions)
    .join('\n')

  const result = await runToolLoopRole<QaReportInput>({
    modelId,
    instructions,
    prompt: buildPrompt(
      context,
      acceptanceCriteriaUsed,
      availableSkillsPrompt,
      preloadedSkillsPrompt,
      extraInstructions,
      prompt
    ),
    tools,
    reportSchema: WRITE_REPORT_INPUT_SCHEMA,
    reportDescription: 'Persist the final QA summary, findings, and environment notes.',
    reserveReportAfterTool: 'agent_device',
    createMissingReport: createMissingQaReport,
    onAgentStep,
    onAgentFinish,
  })

  return {
    reportInput: result.reportInput,
  }
}
