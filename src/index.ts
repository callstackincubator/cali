import 'dotenv/config'

import { createOpenAI } from '@ai-sdk/openai'
import { confirm, log, select, spinner, text } from '@clack/prompts'
import { CoreMessage, generateText } from 'ai'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'
import { z } from 'zod'

import { reactNativePrompt } from './prompt'
import { androidTools } from './tools/android'
import { iosTools } from './tools/apple'
import { reactNativeTools } from './tools/react-native'

const MessageSchema = z.union([
  z.object({ type: z.literal('select'), content: z.string(), options: z.array(z.string()) }),
  z.object({ type: z.literal('question'), content: z.string() }),
  z.object({ type: z.literal('confirmation'), content: z.string() }),
  z.object({ type: z.literal('end'), content: z.string() }),
])

console.clear()

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

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  ((await text({
    message: dedent`
      Please provide your OpenAI API key. 
      
      To skip this message, set ${chalk.bold('OPENAI_API_KEY')} env variable, and run again. 
      
      You can do it in three ways:
      - by creating an ${chalk.bold('.env.local')} file (make sure to ${chalk.bold('.gitignore')} it)
        ${chalk.gray(`\`\`\`
          OPENAI_API_KEY=<your-key>
          \`\`\`
        `)}
      - by passing it inline:
        ${chalk.gray(`\`\`\`
          OPENAI_API_KEY=<your-key> npx cali
          \`\`\`
        `)}
      - by setting it as an env variable in your shell (e.g. in ~/.zshrc or ~/.bashrc):
        ${chalk.gray(`\`\`\`
          export OPENAI_API_KEY=<your-key>
          \`\`\`
        `)}
    `,
  })) as string)

const AI_MODEL = process.env.AI_MODEL || 'gpt-4o'

const openai = createOpenAI({
  apiKey: OPENAI_API_KEY,
})

const question = (await text({
  message: 'What do you want to do today?',
})) as string

const messages: CoreMessage[] = [
  {
    role: 'system',
    content: 'What do you want to do today?',
  },
  {
    role: 'user',
    content: question,
  },
]

const s = spinner()

// eslint-disable-next-line no-constant-condition
while (true) {
  s.start(chalk.gray('Thinking...'))

  const response = await generateText({
    model: openai(AI_MODEL),
    system: reactNativePrompt,
    tools: {
      ...reactNativeTools,
      ...iosTools,
      ...androidTools,
    },
    maxSteps: 10,
    messages,
    onStepFinish(event) {
      if (event.toolCalls.length > 0) {
        s.message(
          `Executing: ${chalk.gray(event.toolCalls.map((toolCall) => toolCall.toolName).join(', '))}`
        )
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

  // tbd: handle parsing errors
  const data = MessageSchema.parse(JSON.parse(response.text))

  const answer = await (() => {
    switch (data.type) {
      case 'select':
        return select({
          message: data.content,
          options: data.options.map((option) => ({ value: option, label: option })),
        })
      case 'question':
        return text({ message: data.content })
      case 'confirmation': {
        return confirm({ message: data.content }).then((answer) => {
          return answer ? 'yes' : 'no'
        })
      }
      case 'end':
        log.step(data.content)
    }
  })()

  if (typeof answer !== 'string') {
    break
  }

  messages.push({
    role: 'user',
    content: answer as string,
  })
}
