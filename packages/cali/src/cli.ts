#!/usr/bin/env node

import 'dotenv/config'

import { createOpenAI } from '@ai-sdk/openai'
import { outro, spinner, text } from '@clack/prompts'
import { CoreAssistantMessage, CoreMessage, generateText } from 'ai'
import { tool } from 'ai'
import { toolbox, userInteractionsToolset } from 'cali-tools'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'
import { z } from 'zod'

import { reactNativePrompt } from './prompt.js'
import { getApiKey } from './utils.js'

console.clear()

process.on('uncaughtException', (error) => {
  console.error(chalk.red(error.message))
  console.log(chalk.gray(error.stack))
})

process.on('SIGINT', function () {
  console.log('Caught interrupt signal')

  process.exit()
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

let sessionOngoing = true
const chosenToolset = null
let messages: CoreMessage[] = []

async function startSession(messages?: CoreMessage[]): Promise<CoreMessage[]> {
  let initialQuestion: CoreAssistantMessage
  const lastMessage = messages?.at(-1)

  if (lastMessage?.role === 'assistant') {
    initialQuestion = {
      role: 'assistant',
      content: lastMessage.content,
    }
  } else {
    initialQuestion = {
      role: 'assistant',
      content: 'What do you want to do today?',
    }
  }

  const question = await text({
    message: initialQuestion.content as string,
    placeholder:
      lastMessage?.role === 'assistant' ? '' : 'e.g. "Build the app" or "See available simulators"',
    validate: (value) => (value.length > 0 ? undefined : 'Please provide a valid answer.'),
  })

  if (typeof question === 'symbol') {
    outro(chalk.gray('Bye!'))
    process.exit(0)
  }

  return [
    ...(messages?.length ? [...messages] : [initialQuestion]),
    {
      role: 'user',
      content: question,
    },
  ]
}

const s = spinner()

const finishSession = tool({
  description: 'Finish the session',
  parameters: z.object({
    restarting_for_tools: z.boolean().describe('Is session ending, or just more tools are needed'),
    farewell_message: z.string().describe('Your farewell message if session is ending').optional(),
  }),
  execute: async ({ farewell_message, restarting_for_tools }) => {
    if (restarting_for_tools) {
      sessionOngoing = true
      return 'Starting new session with more tools'
    }

    sessionOngoing = false
    s.stop(farewell_message)
    return 'Session finished'
  },
})

const toolHand: toolbox.ToolHand = {
  activeTool: null,
}

const gatherNewTool = toolbox.prepareToolbox(toolHand)

// eslint-disable-next-line no-constant-condition
while (sessionOngoing) {
  messages = await startSession(messages)

  s.start(chalk.gray('Thinking...'))

  const response = await generateText({
    model: openai(AI_MODEL),
    system: reactNativePrompt,
    tools: {
      ...userInteractionsToolset.makeInteractiveToolset(s),
      gatherNewTool,
      ...(chosenToolset !== null ? toolbox[chosenToolset] : {}),
      finishSession,
    },
    maxSteps: 10,
    messages,
    toolChoice: 'auto',
  })

  const toolCalls = response.steps.flatMap((step) =>
    step.toolCalls.map((toolCall) => toolCall.toolName)
  )

  if (toolCalls.length > 0) {
    s.stop(`Tools called: ${chalk.gray(toolCalls.join(', '))}`)
  }

  if (!sessionOngoing) {
    s.stop(chalk.gray('Done.'))
  } else {
    s.stop()
    messages.push({ role: 'assistant', content: response.text })
  }
}
