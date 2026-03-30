import { createAnthropic } from '@ai-sdk/anthropic'

const DEFAULT_QA_MODEL_ID = 'openai/gpt-5.4-mini'

function hasGatewayCredentials() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_KEY)
}

function isRunningOnVercel() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_OIDC_TOKEN)
}

function getAnthropicCredentials() {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY,
    authToken: process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.CLAUDE_AUTH_TOKEN,
  }
}

function hasAnthropicCredentials() {
  const anthropic = getAnthropicCredentials()
  return Boolean(anthropic.apiKey || anthropic.authToken)
}

function stripAnthropicPrefix(modelId: string) {
  return modelId.startsWith('anthropic/') ? modelId.slice('anthropic/'.length) : modelId
}

function ensureGatewayApiKeyAlias() {
  if (!process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_KEY) {
    process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_KEY
  }
}

export function resolveQaModelId(configuredModelId?: string) {
  return configuredModelId ?? process.env.QA_MODEL ?? DEFAULT_QA_MODEL_ID
}

export function createQaAgentModel(modelId = resolveQaModelId()) {
  if (hasGatewayCredentials() || isRunningOnVercel()) {
    ensureGatewayApiKeyAlias()
    return modelId
  }

  if (hasAnthropicCredentials()) {
    const anthropicCredentials = getAnthropicCredentials()
    const anthropic = createAnthropic({
      ...(anthropicCredentials.apiKey ? { apiKey: anthropicCredentials.apiKey } : {}),
      ...(anthropicCredentials.authToken ? { authToken: anthropicCredentials.authToken } : {}),
    })

    return anthropic(stripAnthropicPrefix(modelId))
  }

  throw new Error(
    'Missing AI credentials. Set AI_GATEWAY_API_KEY (or AI_GATEWAY_KEY) for gateway access, or ANTHROPIC_API_KEY / CLAUDE_API_KEY for direct Anthropic access.'
  )
}
