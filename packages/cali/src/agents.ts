import { openai } from '@ai-sdk/openai'
import { confirm, select, text } from '@clack/prompts'
import { tool } from 'ai'
import { agent } from 'ai-flows'
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
    Your job is to ask the user for input and return his answer as string.
    You choose the right tool to ask the user for input, depending on the type of question.
    If you are given multiple questions, you must ask them one by one, and return all answers.
    Do not create own questions or ask follow-up questions, unless you are explicitly asked to do so.
  `,
  model: openai('gpt-4o'),
  tools: {
    askOpenEndedUser: tool({
      description: 'Ask the user to answer a question',
      parameters: z.object({
        question: z.string(),
      }),
      execute: async ({ question }) => {
        const answer = await text({
          message: question,
        })
        if (typeof answer !== 'string') {
          throw new Error('User cancelled the operation')
        }
        return answer
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
        const answer = await select({
          message: question,
          options,
        })
        if (typeof answer !== 'string') {
          throw new Error('User cancelled the operation')
        }
        return answer
      },
    }),
    confirmWithUser: tool({
      description: 'Ask the user to confirm something (yes/no)',
      parameters: z.object({
        question: z.string(),
      }),
      execute: async ({ question }) => {
        const answer = await confirm({
          message: question,
        })
        if (typeof answer !== 'boolean') {
          throw new Error('User cancelled the operation')
        }
        return answer
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
  model: openai('gpt-4o'),
  tools: {
    getReactNativeConfig,
    startMetroDevServer,
  },
})

export const appleAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to iOS.
  `,
  model: openai('gpt-4o'),
  tools: appleTools,
})

export const androidAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to Android.
  `,
  model: openai('gpt-4o'),
  tools: androidTools,
})
