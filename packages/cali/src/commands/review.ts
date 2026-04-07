import type { ReviewReport } from '../report/types.js'
import { runReviewRole } from '../roles/review.js'
import type { CommandCliOptions } from '../runtime/types.js'
import { runStructuredCommand } from './shared.js'

function createBlockedReviewReport(summary: string) {
  return {
    overallStatus: 'blocked' as const,
    summary,
    findings: [],
    strengths: [],
    validationGaps: [],
    nextSteps: ['Inspect the repository context and retry the review run.'],
    environmentNotes: [summary],
  }
}

export async function runReviewCommand(cli: CommandCliOptions) {
  return runStructuredCommand({
    commandId: 'review',
    cli,
    roleLabel: 'Review',
    reportLabel: 'Review report',
    createBlockedReport: createBlockedReviewReport,
    composeReport: ({ model, context, reportInput }): ReviewReport => ({
      command: 'review',
      generatedAt: new Date().toISOString(),
      model,
      context,
      overallStatus: reportInput.overallStatus,
      summary: reportInput.summary,
      findings: reportInput.findings ?? [],
      strengths: reportInput.strengths ?? [],
      validationGaps: reportInput.validationGaps ?? [],
      nextSteps: reportInput.nextSteps ?? [],
      environmentNotes: reportInput.environmentNotes ?? [],
    }),
    runRole: runReviewRole,
  })
}
