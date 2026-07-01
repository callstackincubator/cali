import { runCommand } from '../utils.js'
import type { RepositoryContext } from './types.js'

export function sanitizeUrl(rawUrl: string | undefined, options: { stripQuery?: boolean } = {}) {
  if (!rawUrl) {
    return undefined
  }

  try {
    const parsed = new URL(rawUrl)
    parsed.username = ''
    parsed.password = ''
    if (options.stripQuery) {
      parsed.search = ''
      parsed.hash = ''
    }
    return parsed.toString()
  } catch {
    const strippedCredentials = rawUrl
      .replace(/^(https?:\/\/)[^@]+@/, '$1')
      .replace(/^(ssh:\/\/)[^@]+@/, '$1')
    if (options.stripQuery) {
      return strippedCredentials.replace(/[?#].*$/, '')
    }
    return strippedCredentials
  }
}

export function parseRepositoryUrl(
  remoteUrl: string | undefined
): Pick<RepositoryContext, 'provider' | 'owner' | 'name' | 'webUrl'> {
  if (!remoteUrl) {
    return {}
  }

  const httpsMatch = remoteUrl.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return {
      provider: httpsMatch[1],
      owner: httpsMatch[2],
      name: httpsMatch[3],
      webUrl: `https://${httpsMatch[1]}/${httpsMatch[2]}/${httpsMatch[3]}`,
    }
  }

  const sshMatch = remoteUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return {
      provider: sshMatch[1],
      owner: sshMatch[2],
      name: sshMatch[3],
      webUrl: `https://${sshMatch[1]}/${sshMatch[2]}/${sshMatch[3]}`,
    }
  }

  return {}
}

async function readGitValue(cwd: string, args: string[]) {
  const result = await runCommand('git', args, {
    cwd,
    allowFailure: true,
  })

  if (!result.ok) {
    return undefined
  }

  const value = result.stdout.trim()
  return value.length > 0 ? value : undefined
}

async function readDefaultBranch(cwd: string) {
  const symbolicRef = await readGitValue(cwd, [
    'symbolic-ref',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  if (symbolicRef) {
    return symbolicRef.replace(/^origin\//, '')
  }

  const remoteShow = await readGitValue(cwd, ['remote', 'show', 'origin'])
  if (!remoteShow?.includes('HEAD branch:')) {
    return undefined
  }

  return remoteShow
    .split('\n')
    .find((line) => line.includes('HEAD branch:'))
    ?.split('HEAD branch:')[1]
    ?.trim()
}

export async function detectRepositoryContext(cwd: string): Promise<{
  workspaceRoot: string
  repository?: RepositoryContext
}> {
  const workspaceRoot = (await readGitValue(cwd, ['rev-parse', '--show-toplevel'])) ?? cwd
  const remoteUrl = sanitizeUrl(await readGitValue(workspaceRoot, ['remote', 'get-url', 'origin']))
  const repository = {
    ...parseRepositoryUrl(remoteUrl),
    defaultBranch: await readDefaultBranch(workspaceRoot),
    currentBranch: await readGitValue(workspaceRoot, ['branch', '--show-current']),
    commitSha: await readGitValue(workspaceRoot, ['rev-parse', 'HEAD']),
  }

  if (!repository.currentBranch && !repository.commitSha && !repository.owner && !repository.name) {
    return { workspaceRoot }
  }

  return {
    workspaceRoot,
    repository,
  }
}
