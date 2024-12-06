import { createOpenAI } from '@ai-sdk/openai'

import { getApiKey } from './utils.js'

const AI_MODEL = process.env.AI_MODEL || 'gpt-4o'

const openai = createOpenAI({
  apiKey: await getApiKey('OpenAI', 'OPENAI_API_K2EY'),
})

const model = openai(AI_MODEL)

export default model
