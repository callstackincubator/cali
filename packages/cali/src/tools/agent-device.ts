import path from 'node:path'

import type { ToolTraceEntry } from '../runtime/types.js'
import { createCliTool } from './cli-tool.js'

const DEFAULT_AGENT_DEVICE_SESSION_LOCK = 'reject'

type CreateAgentDeviceToolPackOptions = {
  trace: ToolTraceEntry[]
  sessionName: string
  screenshotsDir: string
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

function getDefaultScreenshotFileName() {
  return `screenshot-${new Date().toISOString().replace(/[:.]/g, '-').toLowerCase()}.png`
}

function normalizeScreenshotArgs(args: string[], screenshotsDir: string) {
  if (args.length === 0) {
    return [path.join(screenshotsDir, getDefaultScreenshotFileName())]
  }

  const outFlagIndex = args.findIndex((arg) => arg === '--out')
  if (outFlagIndex >= 0) {
    const outputPath = args[outFlagIndex + 1]
    if (!outputPath || outputPath.startsWith('-')) {
      return args
    }

    const normalizedArgs = [...args]
    normalizedArgs[outFlagIndex + 1] = path.isAbsolute(outputPath)
      ? outputPath
      : path.join(screenshotsDir, outputPath)
    return normalizedArgs
  }

  const [candidatePath, ...rest] = args
  if (!candidatePath || candidatePath.startsWith('-')) {
    return args
  }

  return [
    path.isAbsolute(candidatePath) ? candidatePath : path.join(screenshotsDir, candidatePath),
    ...rest,
  ]
}

function normalizeCommandInvocation(command: string, args: string[], screenshotsDir: string) {
  const trimmedCommand = command.trim()
  if (args.length === 0 && /\s/.test(trimmedCommand)) {
    throw new Error(
      'agent_device expects the subcommand in `command` and each argument in `args`. Do not pass a shell-style command string.'
    )
  }

  const normalizedArgs =
    trimmedCommand === 'screenshot' ? normalizeScreenshotArgs(args, screenshotsDir) : args
  return {
    command: trimmedCommand,
    args: normalizedArgs,
  }
}

export function createAgentDeviceToolPack(options: CreateAgentDeviceToolPackOptions) {
  const { trace, sessionName, screenshotsDir } = options
  const sessionArgs = getAgentDeviceSessionArgs(sessionName, { lockTarget: true })

  return createCliTool({
    toolName: 'agent_device',
    binaryName: 'agent-device',
    description:
      'Run an agent-device command for mobile UI automation and screenshot capture. Use canonical subcommands like back or home directly; do not emulate them with press.',
    trace,
    buildArgs: ({ command, args }) => {
      const normalized = normalizeCommandInvocation(command, args, screenshotsDir)
      return [...sessionArgs, normalized.command, ...normalized.args]
    },
  })
}
