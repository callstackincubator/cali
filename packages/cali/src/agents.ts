import { openai } from '@ai-sdk/openai'
import { confirm, select, text } from '@clack/prompts'
import { tool } from 'ai'
import { agent } from 'workflows-ai'
import { z } from 'zod'

/**
 * Tools
 */
import * as androidTools from 'cali-tools/android'
import * as appleTools from 'cali-tools/apple'
import { getReactNativeConfig, startMetroDevServer } from 'cali-tools/react-native'

/**
 * Helper tool to throw errors when something wents wrong on the tool level.
 */
export const somethingWentWrong = tool({
  description:
    'Call this tool when something went wrong and you cannot return what you were asked for',
  parameters: z.object({
    error: z
      .string()
      .describe('Error message with details and potential recovery steps to display to the user'),
  }),
  execute: async ({ error }): Promise<string> => {
    throw new Error(error)
  },
})

/**
 * Agent that ask the user for input.
 */
export const userInputAgent = agent({
  system: `
    You are a helpful assistant that asks the user for input.
    You are given a question and you must ask the user for input.
    You ask friendly and easy to understand questions.
    You choose the right tool to ask the user for input, depending on the type of question.
    You always return the response in requested format.
    If you need more information, ask a follow-up question.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    askOpenEndedUser: tool({
      description: 'Ask the user to answer a question',
      parameters: z.object({
        question: z.string(),
      }),
      execute: async ({ question }) => {
        return await text({
          message: question,
        })
      },
    }),
    askUserFromList: tool({
      description: 'Ask the user to choose one of the provided options',
      parameters: z.object({
        question: z.string(),
        options: z.array(
          z.object({
            value: z.string().describe('The value of the option'),
            label: z.string().describe('The label that explains the value'),
          })
        ),
      }),
      execute: async ({ question, options }) => {
        return await select({
          message: question,
          options,
        })
      },
    }),
    confirmWithUser: tool({
      description: 'Ask the user to confirm something (yes/no)',
      parameters: z.object({
        question: z.string(),
      }),
      execute: async ({ question }) => {
        return await confirm({
          message: question,
        })
      },
    }),
  },
})

export const reactNativeAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to React Native.
    You do not know what platforms are available.
    You must run a tool to list available platforms.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getReactNativeConfig,
    startMetroDevServer,
  },
})

export const appleAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to iOS.
  `,
  model: openai('gpt-4o-mini'),
  tools: appleTools,
})

export const androidAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to Android.
  `,
  model: openai('gpt-4o-mini'),
  tools: androidTools,
})
