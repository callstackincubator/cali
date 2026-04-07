import { tool } from 'ai'
import { z } from 'zod'

import type { CaliContext } from '../runtime/types.js'

type CreateGitHubToolPackOptions = {
  context: CaliContext
}

export function createGitHubToolPack(options: CreateGitHubToolPackOptions) {
  const { context } = options

  return {
    get_repository_context: tool({
      description: 'Read repository metadata from the normalized Cali context.',
      inputSchema: z.object({}),
      execute: async () => context.repository ?? {},
    }),
    get_pull_request_context: tool({
      description: 'Read pull request metadata from the normalized Cali context.',
      inputSchema: z.object({}),
      execute: async () => context.pullRequest ?? {},
    }),
    get_task_context: tool({
      description: 'Read task metadata from the normalized Cali context.',
      inputSchema: z.object({}),
      execute: async () => context.task ?? {},
    }),
  }
}
