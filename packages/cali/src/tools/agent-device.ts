import { tool } from 'ai'
import { z } from 'zod'

import type { ToolTraceEntry } from '../runtime/types.js'
import { ensureCommandExists, parseJson, runCommand, trimText } from '../utils.js'

const DEFAULT_AGENT_DEVICE_SESSION_LOCK = 'reject'

type CreateAgentDeviceToolPackOptions = {
  trace: ToolTraceEntry[]
  sessionName: string
}

type SessionArgsOptions = {
  lockTarget?: boolean
}

export function getAgentDeviceSessionArgs(sessionName: string, options: SessionArgsOptions = {}) {
  const args = ['--session', sessionName]

  if (options.lockTarget) {
    args.push('--session-lock', DEFAULT_AGENT_DEVICE_SESSION_LOCK)
  }

  return args
}

function normalizeCommandInvocation(command: string, args: string[]) {
  const trimmedCommand = command.trim()

  if (args.length > 0 || !trimmedCommand.includes(' ')) {
    return {
      command: trimmedCommand,
      args,
    }
  }

  const [normalizedCommand, ...normalizedArgs] = trimmedCommand.split(/\s+/g)
  return {
    command: normalizedCommand,
    args: normalizedArgs,
  }
}

export function createAgentDeviceToolPack(options: CreateAgentDeviceToolPackOptions) {
  const { trace, sessionName } = options
  const sessionArgs = getAgentDeviceSessionArgs(sessionName, { lockTarget: true })
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
        await ensureCommandExists('agent-device', 'npm i -g agent-device')
        const normalized = normalizeCommandInvocation(command, args)
        const fullCommand = [...sessionArgs, normalized.command, ...normalized.args]
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
