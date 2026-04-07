import type { ToolTraceEntry } from '../runtime/types.js'
import { createCliTool } from './cli-tool.js'

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

  return createCliTool({
    toolName: 'agent_device',
    binaryName: 'agent-device',
    description:
      'Run an agent-device command for mobile UI automation and screenshot capture. Use canonical subcommands like back or home directly; do not emulate them with press.',
    trace,
    buildArgs: ({ command, args }) => {
      const normalized = normalizeCommandInvocation(command, args)
      return [...sessionArgs, normalized.command, ...normalized.args]
    },
  })
}
