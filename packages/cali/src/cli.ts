#!/usr/bin/env node

import 'dotenv/config'

import { createOpenAI } from '@ai-sdk/openai'
import { outro, spinner, text } from '@clack/prompts'
import { CoreMessage, generateText } from 'ai'
import { userInteractionsToolset } from 'cali-tools'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'
import { z } from 'zod'
import { tool } from 'ai'

import { reactNativePrompt } from './prompt.js'
import { getApiKey } from './utils.js'

console.clear()

process.on('uncaughtException', (error) => {
  console.error(chalk.red(error.message))
  console.log(chalk.gray(error.stack))
})

console.log(
  retro(`
  ██████╗ █████╗ ██╗     ██╗
 ██╔════╝██╔══██╗██║     ██║
 ██║     ███████║██║     ██║
 ██║     ██╔══██║██║     ██║
 ╚██████╗██║  ██║███████╗██║
  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝
`)
)

console.log(
  chalk.gray(dedent`
    AI agent for building React Native apps.
    
    Powered by: ${chalk.bold('Vercel AI SDK')} & ${chalk.bold('React Native CLI')}
  `)
)

console.log()

const AI_MODEL = process.env.AI_MODEL || 'gpt-4o'

const openai = createOpenAI({
  apiKey: await getApiKey('OpenAI', 'OPENAI_API_KEY'),
})

async function startSession(): Promise<CoreMessage[]> {
  const question = await text({
    message: 'What do you want to do today?',
    placeholder: 'e.g. "Build the app" or "See available simulators"',
    validate: (value) => (value.length > 0 ? undefined : 'Please provide a valid answer.'),
  })

  if (typeof question === 'symbol') {
    outro(chalk.gray('Bye!'))
    process.exit(0)
  }

  return [
    {
      role: 'assistant',
      content: 'What do you want to do today?',
    },
    {
      role: 'user',
      content: question,
    },
  ]
}

let messages = await startSession()
let sessionOngoing = true;

const s = spinner()

const finishSession = tool({
  description: 'Finish the session',
  parameters: z.object({
      farewell_message: z.string().describe("You farewell message"),
  }),
  execute: async ({ farewell_message }) => {
    sessionOngoing = false

    s.stop(farewell_message)

    return "Session finished";
  },
})

// eslint-disable-next-line no-constant-condition
while (sessionOngoing) {
  s.start(chalk.gray('Thinking...'))

  const response = await generateText({
    model: openai(AI_MODEL),
    system: reactNativePrompt,
    tools: { ...userInteractionsToolset.makeInteractiveToolset(s), finishSession },
    maxSteps: 10,
    messages,
    toolChoice: "auto",
  })

  const toolCalls = response.steps.flatMap((step) =>
    step.toolCalls.map((toolCall) => toolCall.toolName)
  )

  if (toolCalls.length > 0) {
    s.stop(`Tools called: ${chalk.gray(toolCalls.join(', '))}`)
  } else {
    s.stop(chalk.gray('Done.'))
  }
}
