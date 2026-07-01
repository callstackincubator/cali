import { createAnthropic } from '@ai-sdk/anthropic'

import { DOCS_URLS } from './docs.js'

const DEFAULT_QA_MODEL_ID = 'openai/gpt-5.4-mini'

function stripAnthropicPrefix(modelId: string) {
  return modelId.startsWith('anthropic/') ? modelId.slice('anthropic/'.length) : modelId
}

export function createQaAgentModel(modelId = process.env.QA_MODEL ?? DEFAULT_QA_MODEL_ID) {
  if (process.env.AI_GATEWAY_API_KEY) {
    return modelId
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN
  if (apiKey || authToken) {
    const anthropic = createAnthropic({
      ...(apiKey ? { apiKey } : {}),
      ...(authToken ? { authToken } : {}),
    })

    return anthropic(stripAnthropicPrefix(modelId))
  }

  throw new Error(
    [
      'Missing AI credentials.',
      'Set AI_GATEWAY_API_KEY for gateway access, or ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN for direct Anthropic access.',
      `Docs: ${DOCS_URLS.providerSetup}`,
    ].join('\n\n')
  )
}
