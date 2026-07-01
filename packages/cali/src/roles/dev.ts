import { z } from 'zod'

import type { DevReportInput } from '../report/types.js'
import { runToolLoopRole } from '../runtime/tool-loop-role.js'
import type { CaliContext } from '../runtime/types.js'

type RunDevRoleOptions = {
  context: CaliContext
  modelId: string
  tools: Record<string, any>
  availableSkillsPrompt: string
  preloadedSkillsPrompt: string
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

const DEV_REPORT_INPUT_SCHEMA = z.object({
  overallStatus: z.enum(['passed', 'failed', 'blocked', 'not_tested', 'unsure']),
  summary: z.string(),
  filesChanged: z.array(z.string()).optional(),
  validationsRun: z.array(z.string()).optional(),
  followUps: z.array(z.string()).optional(),
  patchStatus: z.enum(['applied', 'planned', 'blocked', 'partial']).optional(),
  nextSteps: z.array(z.string()).optional(),
  environmentNotes: z.array(z.string()).optional(),
})

function createMissingDevReport(): DevReportInput {
  return {
    overallStatus: 'blocked',
    summary: 'The dev agent completed without calling write_report.',
    filesChanged: [],
    validationsRun: [],
    followUps: [],
    patchStatus: 'blocked',
    nextSteps: ['Inspect the run logs and retry the dev command.'],
    environmentNotes: ['The write_report tool was not called by the agent.'],
  }
}

export async function runDevRole(options: RunDevRoleOptions) {
  const {
    context,
    modelId,
    tools,
    availableSkillsPrompt,
    preloadedSkillsPrompt,
    extraInstructions,
    prompt,
    onAgentStep,
    onAgentFinish,
  } = options

  return runToolLoopRole<DevReportInput>({
    modelId,
    instructions: [
      'You are a React Native and Expo development agent working in a repository-backed sandbox.',
      'Inspect only the files needed to complete the task.',
      'Make the smallest code change that solves the problem.',
      'Use repository write tools carefully and validate with the lightest checks that prove the change.',
    ]
      .concat(extraInstructions)
      .join('\n'),
    prompt: [
      'Implement the requested task in this repository.',
      '',
      `Task title: ${context.task?.title ?? prompt?.trim() ?? 'n/a'}`,
      context.task?.body ?? 'No task body was provided.',
      '',
      `Pull request title: ${context.pullRequest?.title ?? 'n/a'}`,
      context.pullRequest?.body ?? 'No pull request body was provided.',
      '',
      `Write policy: ${context.dev?.writePolicy ?? 'workspace'}`,
      `Push policy: ${context.dev?.pushPolicy ?? 'disabled'}`,
      `Allowed validations: ${(context.dev?.allowedValidations ?? []).join(', ') || 'n/a'}`,
      '',
      preloadedSkillsPrompt,
      '',
      availableSkillsPrompt,
      '',
      'Finish by calling write_report exactly once.',
    ].join('\n'),
    tools,
    reportSchema: DEV_REPORT_INPUT_SCHEMA,
    reportDescription:
      'Persist the development summary, files changed, validations, follow-ups, patch status, and next steps.',
    createMissingReport: createMissingDevReport,
    onAgentStep,
    onAgentFinish,
  })
}
