import { hasToolCall, stepCountIs, tool, ToolLoopAgent } from 'ai'
import { z } from 'zod'
import type { ZodType } from 'zod'

import { createQaAgentModel } from '../model.js'

type RunToolLoopRoleOptions<TOutput> = {
  modelId: string
  instructions: string
  prompt: string
  tools: Record<string, any>
  reportSchema: ZodType<TOutput>
  reportDescription: string
  maxSteps?: number
  reportBufferSteps?: number
  reserveReportAfterTool?: string
  createMissingReport: () => TOutput
  onAgentStep?: (event: {
    stepNumber: number
    finishReason: string
    toolNames: string[]
    totalTokens?: number
  }) => void
  onAgentFinish?: (event: { stepCount: number; finishReason: string; totalTokens?: number }) => void
}

export async function runToolLoopRole<TOutput>(options: RunToolLoopRoleOptions<TOutput>) {
  const {
    modelId,
    instructions,
    prompt,
    tools,
    reportSchema,
    reportDescription,
    maxSteps = 12,
    reportBufferSteps = 2,
    reserveReportAfterTool,
    createMissingReport,
    onAgentStep,
    onAgentFinish,
  } = options
  let reportInput: TOutput | undefined
  let usedReservedTool = false

  const agent = new ToolLoopAgent({
    model: createQaAgentModel(modelId),
    instructions,
    tools: {
      ...tools,
      write_report: tool<TOutput, string>({
        description: reportDescription,
        inputSchema: reportSchema,
        outputSchema: z.string(),
        execute: async (input: TOutput) => {
          if (reportInput) {
            return 'report already captured'
          }

          reportInput = input
          return 'report captured'
        },
      }),
    },
    toolChoice: 'required',
    stopWhen: [stepCountIs(maxSteps), hasToolCall('write_report')],
    onFinish: async ({ steps, finishReason, totalUsage }) => {
      onAgentFinish?.({
        stepCount: steps.length,
        finishReason,
        totalTokens: totalUsage.totalTokens,
      })
    },
    prepareStep: async ({ steps, stepNumber }) => {
      if (!reserveReportAfterTool || reportInput) {
        return {}
      }

      if (!usedReservedTool || stepNumber < maxSteps - reportBufferSteps) {
        return {}
      }

      return {
        activeTools: ['write_report'],
        toolChoice: { type: 'tool', toolName: 'write_report' as const },
      }
    },
  })

  let resultText = ''

  const result = await agent.generate({
    prompt,
    onStepFinish: async ({ stepNumber, finishReason, toolCalls, usage }) => {
      if (
        reserveReportAfterTool &&
        toolCalls.some((toolCall) => toolCall.toolName === reserveReportAfterTool)
      ) {
        usedReservedTool = true
      }

      onAgentStep?.({
        stepNumber: stepNumber + 1,
        finishReason,
        toolNames: toolCalls.map((toolCall) => toolCall.toolName),
        totalTokens: usage.totalTokens,
      })
    },
  })

  resultText = result.text

  if (!reportInput) {
    reportInput = createMissingReport()
  }

  return {
    reportInput,
    resultText,
  }
}
