import type { DevReport } from '../report/types.js'
import { runDevRole } from '../roles/dev.js'
import type { CommandCliOptions } from '../runtime/types.js'
import { runStructuredCommand } from './shared.js'

function createBlockedDevReport(summary: string) {
  return {
    overallStatus: 'blocked' as const,
    summary,
    filesChanged: [],
    validationsRun: [],
    followUps: [],
    patchStatus: 'blocked' as const,
    nextSteps: ['Inspect repository tooling and retry the dev run.'],
    environmentNotes: [summary],
  }
}

export async function runDevCommand(cli: CommandCliOptions) {
  return runStructuredCommand({
    commandId: 'dev',
    cli,
    roleLabel: 'Dev',
    reportLabel: 'Dev report',
    createBlockedReport: createBlockedDevReport,
    composeReport: ({ model, context, reportInput }): DevReport => ({
      command: 'dev',
      generatedAt: new Date().toISOString(),
      model,
      context,
      overallStatus: reportInput.overallStatus,
      summary: reportInput.summary,
      filesChanged: reportInput.filesChanged ?? [],
      validationsRun: reportInput.validationsRun ?? [],
      followUps: reportInput.followUps ?? [],
      patchStatus: reportInput.patchStatus ?? 'planned',
      nextSteps: reportInput.nextSteps ?? [],
      environmentNotes: reportInput.environmentNotes ?? [],
    }),
    getEnabledToolPacks: ({ context, config }) =>
      context.dev?.writePolicy === 'none'
        ? config.enabledToolPacks.filter((toolPackName) => toolPackName !== 'repo-write')
        : config.enabledToolPacks,
    runRole: runDevRole,
  })
}
