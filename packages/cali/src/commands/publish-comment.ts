import { readFile } from 'node:fs/promises'

import { renderGithubComment, renderGithubMultiPlatformComment } from '../report/ci.js'
import type { CommandReport } from '../report/types.js'
import { ensureCommandExists, parseJson, runCommand, trimText } from '../utils.js'

const DEFAULT_COMMENT_MARKER = '<!-- cali:comment -->'

export type PublishCommentOptions = {
  format: 'github' | 'github-multi-platform'
  reportPath?: string
  androidReportPath?: string
  iosReportPath?: string
  bodyPath?: string
  repo?: string
  prNumber?: number
  marker?: string
}

type GithubIssueComment = {
  id: number
  body?: string
}

type GithubTargetHint = {
  repo?: string
  prNumber?: number
}

function readOptionalEnv(name: string) {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}

async function loadReport(reportPath: string) {
  const content = await readFile(reportPath, 'utf8')
  return JSON.parse(content) as CommandReport
}

function extractGithubTargetHint(report?: CommandReport): GithubTargetHint {
  if (!report) {
    return {}
  }

  const owner = report.context.repository?.owner
  const name = report.context.repository?.name

  return {
    repo: owner && name ? `${owner}/${name}` : undefined,
    prNumber: report.context.pullRequest?.number,
  }
}

async function resolveCommentBody(options: PublishCommentOptions) {
  if (options.bodyPath) {
    return readFile(options.bodyPath, 'utf8')
  }

  if (options.format === 'github-multi-platform') {
    const [android, ios] = await Promise.all([
      options.androidReportPath
        ? loadReport(options.androidReportPath)
        : Promise.resolve(undefined),
      options.iosReportPath ? loadReport(options.iosReportPath) : Promise.resolve(undefined),
    ])

    return renderGithubMultiPlatformComment({ android, ios })
  }

  const report = await loadReport(options.reportPath!)
  return renderGithubComment(report)
}

async function detectPrNumberFromGithubActions() {
  const eventPath = readOptionalEnv('GITHUB_EVENT_PATH')
  if (!eventPath) {
    return undefined
  }

  const content = await readFile(eventPath, 'utf8')
  const event = parseJson<{ pull_request?: { number?: number } }>(content, {})
  return event.pull_request?.number
}

async function loadGithubTargetHint(options: PublishCommentOptions): Promise<GithubTargetHint> {
  const reportPaths =
    options.format === 'github-multi-platform'
      ? [options.androidReportPath, options.iosReportPath].filter(Boolean)
      : [options.reportPath].filter(Boolean)

  for (const reportPath of reportPaths) {
    if (!reportPath) {
      continue
    }

    const report = await loadReport(reportPath)
    const hint = extractGithubTargetHint(report)
    if (hint.repo || hint.prNumber) {
      return hint
    }
  }

  return {}
}

async function resolveGithubTarget(options: PublishCommentOptions) {
  const reportHint = await loadGithubTargetHint(options)
  const repo = options.repo ?? reportHint.repo ?? readOptionalEnv('GITHUB_REPOSITORY')
  const prNumber =
    options.prNumber ?? reportHint.prNumber ?? (await detectPrNumberFromGithubActions())

  if (!repo) {
    throw new Error(
      'GitHub comment publishing requires `--repo <owner/name>`, report repository context, or GITHUB_REPOSITORY.'
    )
  }

  if (!prNumber) {
    throw new Error('GitHub comment publishing requires `--pr-number <n>` or pull request context.')
  }

  return {
    repo,
    prNumber,
  }
}

async function listIssueComments(repo: string, prNumber: number) {
  const result = await runCommand(
    'gh',
    ['api', `repos/${repo}/issues/${prNumber}/comments`, '--paginate'],
    { allowFailure: true }
  )

  if (!result.ok) {
    throw new Error(trimText(result.stderr || result.stdout))
  }

  return parseJson<GithubIssueComment[]>(result.stdout, [])
}

async function createIssueComment(repo: string, prNumber: number, body: string) {
  const result = await runCommand(
    'gh',
    [
      'api',
      `repos/${repo}/issues/${prNumber}/comments`,
      '--method',
      'POST',
      '--field',
      `body=${body}`,
    ],
    { allowFailure: true }
  )

  if (!result.ok) {
    throw new Error(trimText(result.stderr || result.stdout))
  }
}

async function updateIssueComment(repo: string, commentId: number, body: string) {
  const result = await runCommand(
    'gh',
    [
      'api',
      `repos/${repo}/issues/comments/${commentId}`,
      '--method',
      'PATCH',
      '--field',
      `body=${body}`,
    ],
    { allowFailure: true }
  )

  if (!result.ok) {
    throw new Error(trimText(result.stderr || result.stdout))
  }
}

export async function publishComment(options: PublishCommentOptions) {
  await ensureCommandExists('gh', 'Install GitHub CLI and make sure `gh` is authenticated.')

  const { repo, prNumber } = await resolveGithubTarget(options)
  const body = await resolveCommentBody(options)
  const marker = options.marker ?? DEFAULT_COMMENT_MARKER
  const finalBody = `${marker}\n${body}`
  const comments = await listIssueComments(repo, prNumber)
  const existingComment = comments.find((comment) => comment.body?.includes(marker))

  if (existingComment) {
    await updateIssueComment(repo, existingComment.id, finalBody)
    console.log(`Updated GitHub PR comment on ${repo}#${prNumber}`)
    return
  }

  await createIssueComment(repo, prNumber, finalBody)
  console.log(`Created GitHub PR comment on ${repo}#${prNumber}`)
}
