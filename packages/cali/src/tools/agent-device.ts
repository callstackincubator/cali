import { tool } from 'ai'
import { z } from 'zod'

import type { AgentDeviceTraceEntry } from '../report/types.js'
import { parseJson, runCommand, trimText } from '../utils.js'

type CreateAgentDeviceToolPackOptions = {
  trace: AgentDeviceTraceEntry[]
}

export function createAgentDeviceToolPack(options: CreateAgentDeviceToolPackOptions) {
  const { trace } = options
  const inputSchema = z.object({
    command: z
      .string()
      .describe(
        'The first agent-device subcommand to run, such as devices, open, snapshot, tap, fill, press, or screenshot.'
      ),
    args: z
      .array(z.string())
      .optional()
      .describe('Remaining CLI arguments for the subcommand.'),
  })

  return {
    agent_device: tool({
      description: 'Run an agent-device command for mobile UI automation and screenshot capture.',
      inputSchema,
      execute: async ({ command, args = [] }) => {
        const result = await runCommand('agent-device', [command, ...args], {
          allowFailure: true,
        })

        trace.push({
          command: [command, ...args].join(' '),
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
