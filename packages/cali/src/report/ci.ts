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

function getPlatformLabel(report: CommandReport) {
  if (report.context.mobile?.platform === 'ios') {
    return 'iOS'
  }

  if (report.context.mobile?.platform === 'android') {
    return 'Android'
  }

  return 'Screenshots'
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

function renderScreenshotCellItem(
  screenshot: ScreenshotInfo,
  options: { showLabel?: boolean } = {}
) {
  const safeLabel = escapeHtml(screenshot.label)
  const safeUrl = sanitizeUrl(screenshot.blobUrl)

  if (!safeUrl) {
    return options.showLabel
      ? `**${safeLabel}**<br>${escapeHtml(screenshot.fileName)}`
      : escapeHtml(screenshot.fileName)
  }

  const image = `<a href="${safeUrl}"><img src="${safeUrl}" alt="${safeLabel}" height="320" /></a>`
  return options.showLabel ? `**${safeLabel}**<br>${image}` : image
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

function createScreenshotColumns(
  reports: Array<{ platformLabel: string; report?: CommandReport }>
) {
  const columns = new Map<
    string,
    {
      label: string
      byPlatform: Map<string, ScreenshotInfo[]>
      order: number
    }
  >()
  const platformLabels = reports.map((report) => report.platformLabel)

  for (const { platformLabel, report } of reports) {
    const screenshots = getScreenshots(report)
    for (const screenshot of screenshots) {
      const key = getScreenshotGroupLabel(screenshot)
      const column = columns.get(key) ?? {
        label: screenshot.label,
        byPlatform: new Map<string, ScreenshotInfo[]>(),
        order: columns.size,
      }

      const platformScreenshots = column.byPlatform.get(platformLabel) ?? []
      platformScreenshots.push(screenshot)
      column.byPlatform.set(platformLabel, platformScreenshots)
      columns.set(key, column)
    }
  }

  return {
    platformLabels,
    columns: [...columns.values()].sort((left, right) => left.order - right.order),
  }
}

function renderScreenshotsTable(reports: Array<{ platformLabel: string; report?: CommandReport }>) {
  const { platformLabels, columns } = createScreenshotColumns(reports)
  if (columns.length === 0) {
    return 'No screenshots recorded.'
  }

  return [
    `| Platform | ${columns.map((column) => toInlineTableCell(column.label)).join(' | ')} |`,
    `| --- | ${columns.map(() => '---').join(' | ')} |`,
    ...platformLabels.map(
      (platformLabel) =>
        `| ${platformLabel} | ${columns
          .map((column) => renderScreenshotGroupCell(column.byPlatform.get(platformLabel) ?? []))
          .join(' | ')} |`
    ),
  ].join('\n')
}

function renderScreenshotGroupCell(screenshots: ScreenshotInfo[]) {
  if (screenshots.length === 0) {
    return 'N/A'
  }

  return screenshots
    .map((screenshot) =>
      renderScreenshotCellItem(screenshot, { showLabel: screenshots.length > 1 })
    )
    .join('<br><br>')
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
    lines.push(
      '',
      '#### Screenshots',
      '',
      renderScreenshotsTable([{ platformLabel: getPlatformLabel(report), report }])
    )
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

  lines.push(
    '',
    '#### Screenshots',
    '',
    renderScreenshotsTable([
      { platformLabel: 'Android', report: android },
      { platformLabel: 'iOS', report: ios },
    ])
  )

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
