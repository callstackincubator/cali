import { tool } from 'ai'
import { z } from 'zod'

import type { ToolTraceEntry } from '../runtime/types.js'
import { ensureCommandExists, parseJson, runCommand, trimText } from '../utils.js'

type CreateReactDevtoolsToolPackOptions = {
  trace: ToolTraceEntry[]
}

export function createReactDevtoolsToolPack(options: CreateReactDevtoolsToolPackOptions) {
  const { trace } = options

  return {
    react_devtools: tool({
      description:
        'Run an agent-react-devtools command to inspect the component tree, props, state, hooks, or profile runtime performance.',
      inputSchema: z.object({
        command: z
          .string()
          .describe('The first subcommand, such as status, get, find, profile, wait.'),
        args: z
          .array(z.string())
          .optional()
          .describe('Remaining CLI arguments for the subcommand.'),
      }),
      execute: async ({ command, args = [] }) => {
        await ensureCommandExists('agent-react-devtools', 'npm i -g agent-react-devtools')
        const fullCommand = [command, ...args]
        const result = await runCommand('agent-react-devtools', fullCommand, {
          allowFailure: true,
        })

        trace.push({
          command: fullCommand.join(' '),
          ok: result.ok,
          exitCode: result.exitCode,
          stdout: trimText(result.stdout, 4000),
          stderr: trimText(result.stderr, 2000),
        })

        return {
          ok: result.ok,
          exitCode: result.exitCode,
          stdout: trimText(result.stdout, 8000),
          stderr: trimText(result.stderr, 4000),
          json: parseJson(result.stdout, null as unknown),
        }
      },
    }),
  }
}
