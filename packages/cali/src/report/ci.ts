import { sanitizeUrl } from '../runtime/context-repo.js'
import { renderCommandSection } from './render.js'
import type { CommandReport, PerfReviewReport, QaReport, ScreenshotInfo } from './types.js'

function hasScreenshots(report: CommandReport): report is QaReport | PerfReviewReport {
  return 'screenshots' in report
}

function getTitle(report: CommandReport) {
  if (report.command === 'qa') {
    if (report.context.mobile?.platform === 'ios') {
      return 'iOS QA'
    }

    if (report.context.mobile?.platform === 'android') {
      return 'Android QA'
    }

    return 'Mobile QA'
  }

  if (report.command === 'perf-review') {
    return 'Perf Review'
  }

  if (report.command === 'review') {
    return 'Code Review'
  }

  return 'Dev'
}

export function getTopIssue(report: CommandReport) {
  switch (report.command) {
    case 'qa':
      return report.issues[0]
    case 'review':
      return report.findings[0]
        ? `[${report.findings[0].severity}] ${report.findings[0].title}: ${report.findings[0].body}`
        : undefined
    case 'perf-review':
      return (
        report.suspectedCauses[0] ??
        report.slowComponents[0]?.detail ??
        report.rerenderHotspots[0]?.detail
      )
    case 'dev':
      return report.followUps[0]
  }
}

export function renderScreenshotsMarkdown(report: CommandReport) {
  if (!hasScreenshots(report) || report.screenshots.length === 0) {
    return '- No screenshots recorded.\n'
  }

  return `${report.screenshots
    .map((screenshot) =>
      sanitizeUrl(screenshot.blobUrl)
        ? `- [${screenshot.label}](${sanitizeUrl(screenshot.blobUrl)})`
        : `- ${screenshot.label}: ${screenshot.fileName}`
    )
    .join('\n')}\n`
}

export function renderScreenshotsCell(report?: CommandReport) {
  if (!report || !hasScreenshots(report) || report.screenshots.length === 0) {
    return 'N/A'
  }

  return report.screenshots
    .map((screenshot) => renderScreenshotCellItem(screenshot))
    .join('<br><br>')
}

function getScreenshots(report?: CommandReport) {
  return report && hasScreenshots(report) ? report.screenshots : []
}

function formatStatusForTable(report?: CommandReport) {
  return report?.overallStatus ?? 'N/A'
}

function formatTopIssueForTable(report?: CommandReport) {
  return report ? toInlineTableCell(getTopIssue(report) ?? 'N/A') : 'N/A'
}

function toInlineTableCell(value: string) {
  return value
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('<br>')
    .replaceAll('|', '\\|')
}

export function buildScreenshotsMetadata(report: CommandReport) {
  return {
    command: report.command,
    platform: report.context.mobile?.platform,
    screenshots: hasScreenshots(report)
      ? report.screenshots.map((screenshot, index) => createScreenshotMetadata(screenshot, index))
      : [],
  }
}

function createScreenshotMetadata(screenshot: ScreenshotInfo, index: number) {
  return {
    order: index,
    label: screenshot.label,
    fileName: screenshot.fileName,
    blobUrl: screenshot.blobUrl,
    blobDownloadUrl: screenshot.blobDownloadUrl,
    blobPathname: screenshot.blobPathname,
    uploadError: screenshot.uploadError,
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderScreenshotCellItem(screenshot: ScreenshotInfo) {
  const safeLabel = escapeHtml(screenshot.label)
  const safeUrl = sanitizeUrl(screenshot.blobUrl)

  if (!safeUrl) {
    return `**${safeLabel}**<br>${escapeHtml(screenshot.fileName)}`
  }

  return `**${safeLabel}**<br><a href="${safeUrl}"><img src="${safeUrl}" alt="${safeLabel}" height="320" /></a>`
}

function normalizeScreenshotGroupLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/\b(android|ios)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getScreenshotGroupLabel(screenshot: ScreenshotInfo) {
  return normalizeScreenshotGroupLabel(screenshot.label) || screenshot.label.toLowerCase()
}

function createScreenshotRows(android?: CommandReport, ios?: CommandReport) {
  const rows = new Map<
    string,
    {
      label: string
      android: ScreenshotInfo[]
      ios: ScreenshotInfo[]
      order: number
    }
  >()

  function add(platform: 'android' | 'ios', screenshots: ScreenshotInfo[]) {
    for (const screenshot of screenshots) {
      const key = getScreenshotGroupLabel(screenshot)
      const row = rows.get(key) ?? {
        label: screenshot.label,
        android: [],
        ios: [],
        order: rows.size,
      }
      row[platform].push(screenshot)
      rows.set(key, row)
    }
  }

  add('android', getScreenshots(android))
  add('ios', getScreenshots(ios))

  return [...rows.values()].sort((left, right) => left.order - right.order)
}

function renderScreenshotsTable(android?: CommandReport, ios?: CommandReport) {
  const rows = createScreenshotRows(android, ios)
  if (rows.length === 0) {
    return 'No screenshots recorded.'
  }

  return [
    '| Focus | Android | iOS |',
    '| --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${toInlineTableCell(row.label)} | ${renderScreenshotGroupCell(row.android)} | ${renderScreenshotGroupCell(row.ios)} |`
    ),
  ].join('\n')
}

function renderScreenshotGroupCell(screenshots: ScreenshotInfo[]) {
  if (screenshots.length === 0) {
    return 'N/A'
  }

  return screenshots.map((screenshot) => renderScreenshotCellItem(screenshot)).join('<br><br>')
}

export function renderGithubComment(report: CommandReport) {
  const lines = [
    `### ${getTitle(report)}`,
    '',
    `**Status:** ${report.overallStatus}`,
    '',
    report.summary || 'No summary was provided.',
  ]

  const topIssue = getTopIssue(report)
  if (topIssue) {
    lines.push('', `**Top issue:** ${topIssue}`)
  }

  if (hasScreenshots(report) && report.screenshots.length > 0) {
    lines.push('', '#### Screenshots', '', renderScreenshotsMarkdown(report).trimEnd())
  }

  if (report.publisherResults?.length) {
    lines.push('', '#### Publishers')
    for (const publisherResult of report.publisherResults) {
      lines.push(
        `- ${publisherResult.publisher}: ${publisherResult.status}${publisherResult.detail ? ` (${publisherResult.detail})` : ''}`
      )
    }
  }

  return `${lines.join('\n')}\n`
}

export function renderGithubMultiPlatformComment(reports: {
  android?: CommandReport
  ios?: CommandReport
}) {
  const { android, ios } = reports
  const lines = ['### Mobile QA']

  lines.push(
    '',
    '| Platform | Status | Top issue |',
    '| --- | --- | --- |',
    `| Android | ${formatStatusForTable(android)} | ${formatTopIssueForTable(android)} |`,
    `| iOS | ${formatStatusForTable(ios)} | ${formatTopIssueForTable(ios)} |`
  )

  lines.push('', '#### Screenshots', '', renderScreenshotsTable(android, ios))

  if (android) {
    lines.push(
      '',
      '<details>',
      '<summary>Android details</summary>',
      '',
      renderCommandSection(android).trimEnd(),
      '',
      '</details>'
    )
  }

  if (ios) {
    lines.push(
      '',
      '<details>',
      '<summary>iOS details</summary>',
      '',
      renderCommandSection(ios).trimEnd(),
      '',
      '</details>'
    )
  }

  return `${lines.join('\n')}\n`
}
