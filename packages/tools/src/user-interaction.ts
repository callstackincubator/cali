import { confirm, select, text } from '@clack/prompts'
import { tool } from 'ai'
import { z } from 'zod'

type Spinner = {
  start: (msg?: string) => void
  stop: (msg?: string, code?: number) => void
  message: (msg?: string) => void
}

export const makeInteractiveToolset = (s: Spinner) => {
  return {
    askQuestion: askQuestion(s),
    getConfirmation: getConfirmation(s),
    presentOptions: presentOptions(s),
    concludeTask,
  }
}

export const askQuestion = (s: Spinner) =>
  tool({
    description: 'Interact with user to as him a question',
    parameters: z.object({
      question: z.string().describe('What do you want to ask'),
    }),
    execute: async ({ question }) => {
      s.stop('A question:')
      const response = await text({
        message: question,
        validate: (value) => (value.length > 0 ? undefined : 'Please provide a valid answer.'),
      })
      s.start()
      return response
    },
  })

export const getConfirmation = (s: Spinner) =>
  tool({
    description: 'Interact with user to get a confirmation before action.',
    parameters: z.object({
      confirmation: z.string().describe('What do you want to confirm with user'),
    }),
    execute: async ({ confirmation }) => {
      s.stop('Please confirm:')
      const response = await confirm({ message: confirmation }).then((answer) => {
        return answer ? 'yes' : 'no'
      })
      s.start()
      return response
    },
  })

export const presentOptions = (s: Spinner) =>
  tool({
    description: 'Interact with user to present him with options selection',
    parameters: z.object({
      description: z.string().describe('Describe the selection for user'),
      options: z.array(z.string()).describe('Array with options for user'),
    }),
    execute: async ({ description, options }) => {
      s.stop('Select an option:')
      const response = await select({
        message: description,
        options: options.map((option) => ({ value: option, label: option })),
      })
      s.start()
      return response
    },
  })

export const concludeTask = tool({
  description: 'Inform user about a finished task',
  parameters: z.object({
    conclusion: z.string().describe('Summarise your work on the task'),
  }),
  execute: async ({ conclusion }) => {
    console.log('Running conclude')
    text({
      message: conclusion,
    })

    const response = await confirm({ message: 'Do you want to continue?' })

    return response
      ? 'Conclusion presented to user, but he wants to continue conversation'
      : 'Conclusion presented, user wants to end the session'
  },
})
