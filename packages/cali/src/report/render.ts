import type { CommandReport, DevReport, PerfReviewReport, QaReport, ReviewReport } from './types.js'

function appendList(lines: string[], title: string, values: string[], empty: string) {
  lines.push('', title)

  if (values.length === 0) {
    lines.push(empty)
    return
  }

  for (const value of values) {
    lines.push(`- ${value}`)
  }
}

function appendMetadata(lines: string[], report: CommandReport) {
  lines.push(
    '',
    '### Metadata',
    `- Command: \`${report.command}\``,
    `- Workspace: \`${report.context.workspaceRoot}\``
  )

  if (report.context.repository?.name) {
    lines.push(
      `- Repository: \`${report.context.repository.owner ?? 'unknown'}/${report.context.repository.name}\``
    )
  }

  if (report.context.pullRequest?.number) {
    lines.push(`- Pull Request: \`#${report.context.pullRequest.number}\``)
  }

  if (report.context.build?.id) {
    lines.push(`- Build ID: \`${report.context.build.id}\``)
  }

  if (report.context.build?.workflowUrl) {
    lines.push(`- Workflow: ${report.context.build.workflowUrl}`)
  }
}

function appendPublishers(lines: string[], report: CommandReport) {
  lines.push('', '### Publishers')

  if (!report.publisherResults || report.publisherResults.length === 0) {
    lines.push('- No publisher results recorded.')
    return
  }

  for (const publisherResult of report.publisherResults) {
    lines.push(
      `- ${publisherResult.publisher}: ${publisherResult.status}${publisherResult.detail ? ` (${publisherResult.detail})` : ''}`
    )
  }
}

function appendJsonReport(lines: string[], report: CommandReport) {
  lines.push('', '### JSON Report', '', '```json', JSON.stringify(report, null, 2), '```')
}

function renderHeader(title: string, report: CommandReport) {
  return [
    title,
    '',
    `**Status:** ${report.overallStatus}`,
    '',
    report.summary || 'No summary was provided.',
  ]
}

function renderQaDetails(lines: string[], report: QaReport) {
  appendList(lines, '### Acceptance Criteria', report.acceptanceCriteriaUsed, '- None recorded.')
  appendList(lines, '### Checked', report.checked, '- No checks were recorded.')
  appendList(lines, '### Issues', report.issues, '- No issues noted.')

  lines.push('', '### Screenshots')
  if (report.screenshots.length === 0) {
    lines.push('- No screenshots were saved.')
  } else {
    for (const screenshot of report.screenshots) {
      lines.push(
        screenshot.blobUrl
          ? `- [${screenshot.label}](${screenshot.blobUrl})`
          : `- ${screenshot.label}: ${screenshot.fileName}`
      )
    }
  }
}

function renderReviewDetails(lines: string[], report: ReviewReport) {
  lines.push('', '### Findings')

  if (report.findings.length === 0) {
    lines.push('- No concrete findings.')
    return
  }

  for (const finding of report.findings) {
    const location =
      finding.file && finding.lineStart
        ? ` (${finding.file}:${finding.lineStart}${finding.lineEnd ? `-${finding.lineEnd}` : ''})`
        : finding.file
          ? ` (${finding.file})`
          : ''

    lines.push(`- [${finding.severity}] ${finding.title}${location}: ${finding.body}`)
  }
}

function renderPerfDetails(lines: string[], report: PerfReviewReport) {
  lines.push('', `**Scenario:** ${report.scenario}`)
  appendList(
    lines,
    '### Slow Components',
    report.slowComponents.map((item) => `${item.label}: ${item.detail}`),
    '- No slow components recorded.'
  )
  appendList(
    lines,
    '### Re-render Hotspots',
    report.rerenderHotspots.map((item) => `${item.label}: ${item.detail}`),
    '- No re-render hotspots recorded.'
  )
  appendList(
    lines,
    '### Suspected Causes',
    report.suspectedCauses,
    '- No suspected causes recorded.'
  )
  appendList(
    lines,
    '### Recommended Fixes',
    report.recommendedFixes,
    '- No recommended fixes recorded.'
  )

  lines.push('', '### Evidence')
  if (report.evidence.length === 0) {
    lines.push('- No evidence recorded.')
    return
  }

  for (const item of report.evidence) {
    lines.push(
      `- [${item.kind}] ${item.label}: ${item.detail}${item.reference ? ` (${item.reference})` : ''}`
    )
  }
}

function renderDevDetails(lines: string[], report: DevReport) {
  lines.push('', `**Patch Status:** ${report.patchStatus}`)
  appendList(lines, '### Files Changed', report.filesChanged, '- No files changed were recorded.')
  appendList(lines, '### Validations Run', report.validationsRun, '- No validations were recorded.')
  appendList(lines, '### Follow Ups', report.followUps, '- No follow-ups recorded.')
}

export function renderCommandSection(report: CommandReport) {
  const title =
    report.command === 'qa'
      ? `### ${report.context.mobile?.platform === 'ios' ? 'iOS' : 'Android'}`
      : `### ${report.command === 'perf-review' ? 'Perf Review' : report.command[0].toUpperCase()}${report.command === 'perf-review' ? '' : report.command.slice(1)}`
  const lines = renderHeader(title, report)

  switch (report.command) {
    case 'qa':
      renderQaDetails(lines, report)
      break
    case 'review':
      renderReviewDetails(lines, report)
      appendList(lines, '### Strengths', report.strengths, '- No strengths recorded.')
      appendList(
        lines,
        '### Validation Gaps',
        report.validationGaps,
        '- No validation gaps recorded.'
      )
      break
    case 'perf-review':
      renderPerfDetails(lines, report)
      break
    case 'dev':
      renderDevDetails(lines, report)
      break
  }

  appendList(
    lines,
    '### Next Steps',
    report.nextSteps ?? [],
    '- No follow-up actions were suggested.'
  )
  appendList(
    lines,
    '### Environment Notes',
    report.environmentNotes ?? [],
    '- No environment notes recorded.'
  )
  appendPublishers(lines, report)
  appendMetadata(lines, report)
  appendJsonReport(lines, report)

  return `${lines.join('\n')}\n`
}
