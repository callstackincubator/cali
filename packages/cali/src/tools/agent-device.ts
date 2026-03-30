import { tool } from 'ai'
import { z } from 'zod'

import type { AgentDeviceTraceEntry } from '../report/types.js'
import { parseJson, runCommand, trimText } from '../utils.js'

export const DEFAULT_AGENT_DEVICE_SESSION_NAME = 'default'
const DEFAULT_AGENT_DEVICE_SESSION_LOCK = 'strip'

type CreateAgentDeviceToolPackOptions = {
  trace: AgentDeviceTraceEntry[]
  sessionName?: string
}

export function getAgentDeviceSessionArgs(
  sessionName = process.env.AGENT_DEVICE_SESSION ?? DEFAULT_AGENT_DEVICE_SESSION_NAME
) {
  return ['--session', sessionName, '--session-lock', DEFAULT_AGENT_DEVICE_SESSION_LOCK]
}

export function createAgentDeviceToolPack(options: CreateAgentDeviceToolPackOptions) {
  const { trace, sessionName } = options
  const sessionArgs = getAgentDeviceSessionArgs(sessionName)
  const inputSchema = z.object({
    command: z
      .string()
      .describe(
        'The first agent-device subcommand to run, such as snapshot, get, press, click, fill, type, wait, back, home, or screenshot.'
      ),
    args: z.array(z.string()).optional().describe('Remaining CLI arguments for the subcommand.'),
  })

  return {
    agent_device: tool({
      description:
        'Run an agent-device command for mobile UI automation and screenshot capture. Use canonical subcommands like back or home directly; do not emulate them with press.',
      inputSchema,
      execute: async ({ command, args = [] }) => {
        const fullCommand = [...sessionArgs, command, ...args]
        const result = await runCommand('agent-device', fullCommand, {
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
