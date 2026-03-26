import type { QaReport, ResultStatus } from './types.js'

function getStatusLabel(status: ResultStatus) {
  switch (status) {
    case 'passed':
      return 'passed'
    case 'failed':
      return 'failed'
    case 'blocked':
      return 'blocked'
    case 'unsure':
      return 'unsure'
    case 'not_tested':
    default:
      return 'not_tested'
  }
}

export function renderQaSection(report: QaReport) {
  const lines = [
    `### ${report.context.platform === 'ios' ? 'iOS' : 'Android'}`,
    '',
    `**Status:** ${getStatusLabel(report.overallStatus)}`,
    '',
    report.summary || 'No summary was provided.',
    '',
    '### Checked',
  ]

  if (report.checked?.length) {
    for (const item of report.checked) {
      lines.push(`- ${item}`)
    }
  } else {
    lines.push('- No checks were recorded.')
  }

  lines.push('', '### Issues')
  if (report.issues?.length) {
    for (const issue of report.issues) {
      lines.push(`- ${issue}`)
    }
  } else {
    lines.push('- No issues noted.')
  }

  lines.push('', '### Screenshots')
  if (report.screenshots.length === 0) {
    lines.push('- No screenshots were saved.')
  } else {
    for (const screenshot of report.screenshots) {
      if (screenshot.blobUrl) {
        lines.push(`- [${screenshot.label}](${screenshot.blobUrl})`)
      } else {
        lines.push(`- ${screenshot.label}: ${screenshot.fileName}`)
      }
    }
  }

  lines.push('', '### Next steps')
  if (report.nextSteps?.length) {
    for (const step of report.nextSteps) {
      lines.push(`- ${step}`)
    }
  } else {
    lines.push('- No follow-up actions were suggested.')
  }

  lines.push('', '### Metadata')
  lines.push(`- Platform: \`${report.context.platform}\``)
  lines.push(`- App ID: \`${report.context.appId}\``)
  lines.push(`- Build ID: \`${report.context.buildId || 'n/a'}\``)
  lines.push(`- Workflow: ${report.context.workflowUrl || 'n/a'}`)
  lines.push('', '### JSON Report', '', '```json', JSON.stringify(report, null, 2), '```')

  return `${lines.join('\n')}\n`
}
