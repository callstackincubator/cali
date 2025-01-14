import { confirm, isCancel, select, text } from '@clack/prompts'
import { tool } from 'ai'
import { z } from 'zod'

export const askQuestion = tool({
  description: 'Ask user a question',
  parameters: z.object({
    question: z.string().describe('What do you want to ask'),
  }),
  execute: async ({ question }) => {
    const response = await text({
      message: question,
      validate: (value) => (value.length > 0 ? undefined : 'Please provide a valid answer.'),
    })

    if (isCancel(response)) {
      throw new Error('UserCancelledOperation')
    }

    return response
  },
})

export const confirmOperation = tool({
  description: 'Interact with user to get a confirmation before action.',
  parameters: z.object({
    confirmation: z.string().describe('What do you want to confirm with user'),
  }),
  execute: async ({ confirmation }) => {
    const response = await confirm({ message: confirmation }).then((answer) => {
      return answer ? 'yes' : 'no'
    })

    if (isCancel(response)) {
      throw new Error('UserCancelledOperation')
    }

    return response
  },
})

export const presentOptions = tool({
  description: 'Interact with user to present him with options selection',
  parameters: z.object({
    description: z.string().describe('Describe the selection for user'),
    options: z.array(z.string()).describe('Array with options for user'),
  }),
  execute: async ({ description, options }) => {
    const response = await select({
      message: description,
      options: options.map((option) => ({ value: option, label: option })),
    })

    if (isCancel(response)) {
      throw new Error('UserCancelledOperation')
    }

    return response
  },
})
