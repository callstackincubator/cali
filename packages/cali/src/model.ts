import { createAnthropic } from '@ai-sdk/anthropic'

import { DOCS_URLS } from './docs.js'

const DEFAULT_QA_MODEL_ID = 'openai/gpt-5.4-mini'

function stripAnthropicPrefix(modelId: string) {
  return modelId.startsWith('anthropic/') ? modelId.slice('anthropic/'.length) : modelId
}

export function createQaAgentModel(modelId = process.env.QA_MODEL ?? DEFAULT_QA_MODEL_ID) {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_KEY
  if (gatewayKey || process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_OIDC_TOKEN) {
    if (!process.env.AI_GATEWAY_API_KEY && gatewayKey) {
      process.env.AI_GATEWAY_API_KEY = gatewayKey
    }

    return modelId
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.CLAUDE_AUTH_TOKEN
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
      'Set AI_GATEWAY_API_KEY (or AI_GATEWAY_KEY) for gateway access, or ANTHROPIC_API_KEY / CLAUDE_API_KEY for direct Anthropic access.',
      `Docs: ${DOCS_URLS.providerSetup}`,
    ].join('\n\n')
  )
}
