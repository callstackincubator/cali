import { execFile as execFileCallback } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import type { CaliPlatform } from './runtime/types.js'

const execFile = promisify(execFileCallback)

type CommandResult = {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
}

type CommandOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  allowFailure?: boolean
}

type ExecFileError = Error & {
  stdout?: string
  stderr?: string
  status?: number | null
  code?: number | string
}

const commandExistsCache = new Map<string, boolean>()

export async function runCommand(
  file: string,
  args: string[],
  options: CommandOptions = {}
): Promise<CommandResult> {
  const { cwd = process.cwd(), env = process.env, allowFailure = false } = options

  try {
    const result = await execFile(file, args, {
      cwd,
      env,
      maxBuffer: 20 * 1024 * 1024,
    })

    return {
      ok: true,
      exitCode: 0,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    }
  } catch (unknownError) {
    const error = unknownError as ExecFileError
    const stdout = typeof error.stdout === 'string' ? error.stdout : ''
    const stderr = typeof error.stderr === 'string' ? error.stderr : error.message
    const exitCode =
      typeof error.status === 'number'
        ? error.status
        : typeof error.code === 'number'
          ? error.code
          : 1

    if (!allowFailure) {
      throw new Error(
        [`Command failed: ${file} ${args.join(' ')}`, stderr || stdout].filter(Boolean).join('\n\n')
      )
    }

    return {
      ok: false,
      exitCode,
      stdout,
      stderr,
    }
  }
}

export async function ensureCommandExists(commandName: string, installHint: string) {
  const cached = commandExistsCache.get(commandName)
  if (cached === true) {
    return
  }

  const result = await runCommand('which', [commandName], { allowFailure: true })
  if (result.ok && result.stdout.trim()) {
    commandExistsCache.set(commandName, true)
    return
  }

  throw new Error(
    `Missing required CLI: ${commandName}\n\nInstall it before running Cali:\n${installHint}`
  )
}

export async function ensureDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true })
}

export function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function trimText(value: string, max = 6000) {
  if (value.length <= max) {
    return value
  }

  return `${value.slice(0, max)}\n...<truncated>`
}

export function uniqueStrings(values: Array<string | undefined>) {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim())
    ),
  ]
}

export function asArray(value: string | string[] | undefined) {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

export function resolveFromCwd(cwd: string, targetPath: string) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(cwd, targetPath)
}

export function normalizePlatform(value: string | undefined): CaliPlatform | undefined {
  if (value === 'android' || value === 'ios') {
    return value
  }

  return undefined
}

export function humanizeScreenshotLabel(fileName: string) {
  const stem = fileName.replace(/\.[^.]+$/, '')
  const words = stem
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))

  return words.join(' ') || fileName
}
