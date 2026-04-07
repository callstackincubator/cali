import { runCommand } from '../utils.js'
import type { RepositoryContext } from './types.js'

function parseRemoteUrl(remoteUrl: string | undefined) {
  if (!remoteUrl) {
    return {}
  }

  const httpsMatch = remoteUrl.match(/^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return {
      provider: httpsMatch[1],
      owner: httpsMatch[2],
      name: httpsMatch[3],
    }
  }

  const sshMatch = remoteUrl.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return {
      provider: sshMatch[1],
      owner: sshMatch[2],
      name: sshMatch[3],
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

export async function detectRepositoryContext(cwd: string): Promise<{
  workspaceRoot: string
  repository?: RepositoryContext
}> {
  const workspaceRoot = (await readGitValue(cwd, ['rev-parse', '--show-toplevel'])) ?? cwd
  const remoteUrl = await readGitValue(workspaceRoot, ['remote', 'get-url', 'origin'])
  const repository = {
    ...parseRemoteUrl(remoteUrl),
    cloneUrl: remoteUrl,
    defaultBranch: await readGitValue(workspaceRoot, ['remote', 'show', 'origin']),
    currentBranch: await readGitValue(workspaceRoot, ['branch', '--show-current']),
    commitSha: await readGitValue(workspaceRoot, ['rev-parse', 'HEAD']),
  }

  if (
    !repository.cloneUrl &&
    !repository.currentBranch &&
    !repository.commitSha &&
    !repository.owner &&
    !repository.name
  ) {
    return { workspaceRoot }
  }

  if (repository.defaultBranch?.includes('HEAD branch:')) {
    repository.defaultBranch = repository.defaultBranch
      .split('\n')
      .find((line) => line.includes('HEAD branch:'))
      ?.split('HEAD branch:')[1]
      ?.trim()
  }

  return {
    workspaceRoot,
    repository,
  }
}
