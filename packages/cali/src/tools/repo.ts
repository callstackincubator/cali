import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { tool } from 'ai'
import { z } from 'zod'

import { ensureCommandExists, ensureDirectory, resolveFromCwd, runCommand } from '../utils.js'

type RepoReadToolPackOptions = {
  workspaceRoot: string
}

type RepoWriteToolPackOptions = {
  workspaceRoot: string
  allowedCommands?: string[]
}

export function createRepoReadToolPack(options: RepoReadToolPackOptions) {
  const { workspaceRoot } = options
  const ensureRipgrep = () =>
    ensureCommandExists('rg', 'Install ripgrep and make sure `rg` is on PATH.')
  const ensureGit = () => ensureCommandExists('git', 'Install Git and make sure `git` is on PATH.')

  return {
    list_repo_files: tool({
      description: 'List repository files using ripgrep file discovery.',
      inputSchema: z.object({
        pattern: z.string().optional(),
        maxResults: z.number().int().min(1).max(500).optional(),
      }),
      execute: async ({ pattern, maxResults = 200 }) => {
        await ensureRipgrep()
        const args = ['--files']
        if (pattern?.trim()) {
          args.push('-g', pattern.trim())
        }

        const result = await runCommand('rg', args, {
          cwd: workspaceRoot,
          allowFailure: true,
        })

        return {
          ok: result.ok,
          files: result.stdout
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, maxResults),
          stderr: result.stderr,
        }
      },
    }),
    search_repo: tool({
      description: 'Search repository files with ripgrep and return matching lines.',
      inputSchema: z.object({
        query: z.string(),
        glob: z.string().optional(),
        maxResults: z.number().int().min(1).max(200).optional(),
      }),
      execute: async ({ query, glob, maxResults = 100 }) => {
        await ensureRipgrep()
        const args = ['-n', '--no-heading', query]
        if (glob?.trim()) {
          args.push('-g', glob.trim())
        }

        const result = await runCommand('rg', args, {
          cwd: workspaceRoot,
          allowFailure: true,
        })

        return {
          ok: result.ok,
          matches: result.stdout
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean)
            .slice(0, maxResults),
          stderr: result.stderr,
        }
      },
    }),
    read_repo_file: tool({
      description: 'Read a repository file, optionally scoped to a line window.',
      inputSchema: z.object({
        path: z.string(),
        startLine: z.number().int().min(1).optional(),
        maxLines: z.number().int().min(1).max(400).optional(),
      }),
      execute: async ({ path: relativePath, startLine = 1, maxLines = 200 }) => {
        const absolutePath = resolveFromCwd(workspaceRoot, relativePath)
        const content = await readFile(absolutePath, 'utf8')
        const lines = content.split('\n')
        const slice = lines.slice(startLine - 1, startLine - 1 + maxLines)

        return {
          absolutePath,
          startLine,
          endLine: startLine + slice.length - 1,
          content: slice.join('\n'),
        }
      },
    }),
    git_status: tool({
      description: 'Read the current git status for the repository.',
      inputSchema: z.object({}),
      execute: async () => {
        await ensureGit()
        const result = await runCommand('git', ['status', '--short', '--branch'], {
          cwd: workspaceRoot,
          allowFailure: true,
        })

        return {
          ok: result.ok,
          stdout: result.stdout.trim(),
          stderr: result.stderr.trim(),
        }
      },
    }),
    git_diff: tool({
      description: 'Read a git diff from the repository or a specific file path.',
      inputSchema: z.object({
        baseRef: z.string().optional(),
        path: z.string().optional(),
        maxLines: z.number().int().min(1).max(800).optional(),
      }),
      execute: async ({ baseRef, path: relativePath, maxLines = 400 }) => {
        await ensureGit()
        const args = ['diff']
        if (baseRef?.trim()) {
          args.push(baseRef.trim())
        }
        if (relativePath?.trim()) {
          args.push('--', relativePath.trim())
        }

        const result = await runCommand('git', args, {
          cwd: workspaceRoot,
          allowFailure: true,
        })

        return {
          ok: result.ok,
          diff: result.stdout.split('\n').slice(0, maxLines).join('\n'),
          stderr: result.stderr.trim(),
        }
      },
    }),
  }
}

export function createRepoWriteToolPack(options: RepoWriteToolPackOptions) {
  const { workspaceRoot, allowedCommands = [] } = options
  const ensureShell = () =>
    ensureCommandExists(
      'zsh',
      'Install zsh and make sure `zsh` is on PATH for repository commands.'
    )

  return {
    write_repo_file: tool({
      description: 'Write a repository file with full replacement content.',
      inputSchema: z.object({
        path: z.string(),
        content: z.string(),
      }),
      execute: async ({ path: relativePath, content }) => {
        const absolutePath = resolveFromCwd(workspaceRoot, relativePath)
        await ensureDirectory(path.dirname(absolutePath))
        await writeFile(absolutePath, content, 'utf8')

        return {
          ok: true,
          absolutePath,
        }
      },
    }),
    delete_repo_file: tool({
      description: 'Delete a repository file.',
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path: relativePath }) => {
        const absolutePath = resolveFromCwd(workspaceRoot, relativePath)
        await rm(absolutePath, { force: true })

        return {
          ok: true,
          absolutePath,
        }
      },
    }),
    run_repo_command: tool({
      description:
        'Run a shell command inside the repository workspace. Use this for validation commands and project scripts.',
      inputSchema: z.object({
        command: z.string(),
      }),
      execute: async ({ command }) => {
        await ensureShell()
        if (allowedCommands.length > 0 && !allowedCommands.includes(command)) {
          return {
            ok: false,
            exitCode: 1,
            stdout: '',
            stderr: `Command is not allowed by the current write policy. Allowed commands: ${allowedCommands.join(', ')}`,
          }
        }

        const result = await runCommand('zsh', ['-lc', command], {
          cwd: workspaceRoot,
          allowFailure: true,
        })

        return {
          ok: result.ok,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        }
      },
    }),
  }
}
