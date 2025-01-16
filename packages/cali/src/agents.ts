import { openai } from '@ai-sdk/openai'
import { confirm, select, text } from '@clack/prompts'
import { tool } from 'ai'
import {
  bootAndroidEmulator,
  bootAppleSimulator,
  buildAndroidApp,
  buildAppleAppWithoutStarting,
  buildStartAppleApp,
  getAdbPath,
  getAndroidDevices,
  getAppleSimulators,
  getReactNativeConfig,
  launchAndroidAppOnDevice,
  runAdbReverse,
  startAppleLogging,
  startMetroDevServer,
} from 'cali-tools'
import { agent } from 'workflows-ai'
import { z } from 'zod'

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
        options: z.array(z.string()),
      }),
      execute: async ({ question, options }) => {
        return await select({
          message: question,
          options: options.map((option) => ({
            value: option,
            label: option,
          })),
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
    startMetroDevServer,
    getReactNativeConfig,
  },
})

export const appleAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to iOS.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getAppleSimulators,
    bootAppleSimulator,
    buildAppleAppWithoutStarting,
    buildStartAppleApp,
    startAppleLogging,
  },
})

export const androidAgent = agent({
  system: `
    You are a helpful assistant that helps with everything related to Android.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getAdbPath,
    getAndroidDevices,
    bootAndroidEmulator,
    buildAndroidApp,
    runAdbReverse,
    launchAndroidAppOnDevice,
  },
})
