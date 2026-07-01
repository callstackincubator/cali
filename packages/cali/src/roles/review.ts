import { z } from 'zod'

import type { ReviewReportInput } from '../report/types.js'
import { runToolLoopRole } from '../runtime/tool-loop-role.js'
import type { CaliContext } from '../runtime/types.js'

type RunReviewRoleOptions = {
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

const REVIEW_REPORT_INPUT_SCHEMA = z.object({
  overallStatus: z.enum(['passed', 'failed', 'blocked', 'not_tested', 'unsure']),
  summary: z.string(),
  findings: z
    .array(
      z.object({
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        title: z.string(),
        body: z.string(),
        file: z.string().optional(),
        lineStart: z.number().int().optional(),
        lineEnd: z.number().int().optional(),
      })
    )
    .optional(),
  strengths: z.array(z.string()).optional(),
  validationGaps: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  environmentNotes: z.array(z.string()).optional(),
})

function createMissingReviewReport(): ReviewReportInput {
  return {
    overallStatus: 'blocked',
    summary: 'The review agent completed without calling write_report.',
    findings: [],
    strengths: [],
    validationGaps: [],
    nextSteps: ['Inspect the run logs and retry the review command.'],
    environmentNotes: ['The write_report tool was not called by the agent.'],
  }
}

export async function runReviewRole(options: RunReviewRoleOptions) {
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

  return runToolLoopRole<ReviewReportInput>({
    modelId,
    instructions: [
      'You are a mobile code review agent for React Native and Expo pull requests.',
      'Review diff and repository context only. Do not modify code.',
      'Prioritize correctness risks, platform regressions, missing validation, and maintainability concerns.',
      'Output findings first and keep them concrete.',
    ]
      .concat(extraInstructions)
      .join('\n'),
    prompt: [
      'Review this pull request or repository snapshot.',
      '',
      `Pull request title: ${context.pullRequest?.title ?? 'n/a'}`,
      context.pullRequest?.body ?? 'No pull request body was provided.',
      '',
      `Task title: ${context.task?.title ?? 'n/a'}`,
      context.task?.body ?? 'No task body was provided.',
      '',
      preloadedSkillsPrompt,
      '',
      availableSkillsPrompt,
      '',
      prompt?.trim() ? `Task-specific focus:\n${prompt.trim()}` : '',
      'Use repository and git tools to inspect the relevant diff or file context.',
      'Finish by calling write_report exactly once.',
    ]
      .filter(Boolean)
      .join('\n'),
    tools,
    reportSchema: REVIEW_REPORT_INPUT_SCHEMA,
    reportDescription:
      'Persist the final review findings, strengths, validation gaps, and next steps.',
    createMissingReport: createMissingReviewReport,
    onAgentStep,
    onAgentFinish,
  })
}
