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
      screenshot.blobUrl
        ? `- [${screenshot.label}](${screenshot.blobUrl})`
        : `- ${screenshot.label}: ${screenshot.fileName}`
    )
    .join('\n')}\n`
}

export function renderScreenshotsCell(report?: CommandReport) {
  if (!report || !hasScreenshots(report) || report.screenshots.length === 0) {
    return 'N/A'
  }

  return report.screenshots
    .map((screenshot) =>
      screenshot.blobUrl
        ? `**${screenshot.label}**<br><a href="${screenshot.blobUrl}"><img src="${screenshot.blobUrl}" alt="${screenshot.label}" height="320" /></a>`
        : `**${screenshot.label}**<br>${screenshot.fileName}`
    )
    .join('<br><br>')
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

  lines.push(
    '',
    '#### Screenshots',
    '',
    '| Android | iOS |',
    '| --- | --- |',
    `| ${renderScreenshotsCell(android)} | ${renderScreenshotsCell(ios)} |`
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
