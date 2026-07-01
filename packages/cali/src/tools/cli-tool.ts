import { tool } from 'ai'
import { z } from 'zod'

import type { ToolTraceEntry } from '../runtime/types.js'
import { parseJson, runCommand, trimText } from '../utils.js'

type CreateCliToolOptions = {
  toolName: string
  binaryName: string
  description: string
  trace: ToolTraceEntry[]
  buildArgs?: (args: { command: string; args: string[] }) => string[]
}

const inputSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
})

export function createCliTool(options: CreateCliToolOptions) {
  const { toolName, binaryName, description, trace, buildArgs } = options

  return {
    [toolName]: tool({
      description,
      inputSchema,
      execute: async ({ command, args = [] }) => {
        const fullCommand = buildArgs ? buildArgs({ command, args }) : [command, ...args]
        const result = await runCommand(binaryName, fullCommand, {
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
