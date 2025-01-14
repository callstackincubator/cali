#!/usr/bin/env node

import 'dotenv/config'

import { createOpenAI } from '@ai-sdk/openai'
import { outro, spinner, text } from '@clack/prompts'
import { CoreMessage, generateText } from 'ai'
import * as tools from 'cali-tools'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'
import { isValid } from 'zod'

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
      role: 'system',
      content: 'What do you want to do today?',
    },
    {
      role: 'user',
      content: question,
    },
  ]
}

let messages = await startSession()

const s = spinner()

// eslint-disable-next-line no-constant-condition
while (true) {
  s.start(chalk.gray('Thinking...'))

  try {
    const response = await generateText({
      model: openai(AI_MODEL),
      system: reactNativePrompt,
      tools,
      maxSteps: 10,
      messages,
      onStepStart(toolCalls) {
        if (toolCalls.length > 0) {
          const message = `Executing: ${chalk.gray(toolCalls.map((toolCall) => toolCall.toolName).join(', '))}`

          let spinner = s.message
          for (const toolCall of toolCalls) {
            /**
             * Certain tools call external helpers outside of our control that pipe output to our stdout.
             * In such case, we stop the spinner to avoid glitches and display the output instead.
             */
            if (
              [
                'buildAndroidApp',
                'launchAndroidAppOnDevice',
                'installNpmPackage',
                'uninstallNpmPackage',
                'askQuestion',
                'confirmOperation',
                'presentOptions',
              ].includes(toolCall.toolName)
            ) {
              spinner = s.stop
              break
            }
          }

          spinner(message)
        }
      },
    })

    const toolCalls = response.steps.flatMap((step) =>
      step.toolCalls.map((toolCall) => toolCall.toolName)
    )

    if (toolCalls.length > 0) {
      s.stop(`Tools called: ${chalk.gray(toolCalls.join(', '))}`)
    } else {
      s.stop(chalk.gray('Done.'))
    }

    for (const step of response.steps) {
      if (step.text.length > 0) {
        messages.push({ role: 'assistant', content: step.text })
      }
      if (step.toolCalls.length > 0) {
        messages.push({ role: 'assistant', content: step.toolCalls })
      }
      if (step.toolResults.length > 0) {
        // tbd: fix this upstream. for some reason, the tool does not include the type,
        // against the spec.
        for (const toolResult of step.toolResults) {
          if (!toolResult.type) {
            toolResult.type = 'tool-result'
          }
        }
        messages.push({ role: 'tool', content: step.toolResults })
      }
    }

    const userResponse = await text({
      message: response.text,
      validate: (value) => (value.length > 0 ? undefined : 'Please provide a valid answer.'),
    })

    if (typeof userResponse === 'string') {
      messages.push({ role: 'user', content: userResponse.toString() })
    } else {
      messages = await startSession()
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UserCancelledOperation') {
      messages = await startSession()
      continue
    } else {
      throw e
    }
  }
}
