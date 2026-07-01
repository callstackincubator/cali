import { z } from 'zod'

import type { PerfReviewReportInput } from '../report/types.js'
import { runToolLoopRole } from '../runtime/tool-loop-role.js'
import type { CaliContext } from '../runtime/types.js'

type RunPerfReviewRoleOptions = {
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

const PERF_REVIEW_REPORT_SCHEMA = z.object({
  overallStatus: z.enum(['passed', 'failed', 'blocked', 'not_tested', 'unsure']),
  summary: z.string(),
  scenario: z.string().optional(),
  slowComponents: z
    .array(
      z.object({
        label: z.string(),
        detail: z.string(),
      })
    )
    .optional(),
  rerenderHotspots: z
    .array(
      z.object({
        label: z.string(),
        detail: z.string(),
      })
    )
    .optional(),
  suspectedCauses: z.array(z.string()).optional(),
  evidence: z
    .array(
      z.object({
        kind: z.enum(['component', 'profile', 'screenshot', 'note']),
        label: z.string(),
        detail: z.string(),
        reference: z.string().optional(),
      })
    )
    .optional(),
  recommendedFixes: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional(),
  environmentNotes: z.array(z.string()).optional(),
})

function createMissingPerfReviewReport(): PerfReviewReportInput {
  return {
    overallStatus: 'blocked',
    summary: 'The perf-review agent completed without calling write_report.',
    scenario: 'Blocked runtime performance review',
    slowComponents: [],
    rerenderHotspots: [],
    suspectedCauses: [],
    evidence: [],
    recommendedFixes: [],
    nextSteps: ['Inspect the run logs and retry the perf-review command.'],
    environmentNotes: ['The write_report tool was not called by the agent.'],
  }
}

export async function runPerfReviewRole(options: RunPerfReviewRoleOptions) {
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

  return runToolLoopRole<PerfReviewReportInput>({
    modelId,
    instructions: [
      'You are a runtime performance review agent for React Native and Expo apps.',
      'Use agent-device to drive the app and react-devtools to inspect component tree and profile data.',
      'Prioritize re-renders, slow interactions, and evidence-backed suspected causes.',
      'Do not change the repository.',
    ]
      .concat(extraInstructions)
      .join('\n'),
    prompt: [
      `Review the runtime performance of this ${context.mobile?.platform === 'ios' ? 'iOS' : 'Android'} app.`,
      '',
      `Target flow: ${context.perfReview?.targetFlow ?? prompt?.trim() ?? 'n/a'}`,
      `Expected interaction: ${context.perfReview?.expectedInteraction ?? 'n/a'}`,
      `Profiling goals: ${(context.perfReview?.profilingGoals ?? []).join(', ') || 'n/a'}`,
      `Suspected screens/components: ${(context.perfReview?.suspectedScreens ?? []).join(', ') || 'n/a'}`,
      '',
      preloadedSkillsPrompt,
      '',
      availableSkillsPrompt,
      '',
      'Treat bootstrap as already handled. Use the provided performance tools only.',
      'Finish by calling write_report exactly once.',
    ].join('\n'),
    tools,
    reportSchema: PERF_REVIEW_REPORT_SCHEMA,
    reportDescription:
      'Persist the performance review summary, hotspots, suspected causes, evidence, and recommended fixes.',
    reserveReportAfterTool: 'react_devtools',
    createMissingReport: createMissingPerfReviewReport,
    onAgentStep,
    onAgentFinish,
  })
}
