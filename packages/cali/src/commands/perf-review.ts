import type { PerfReviewReport, ScreenshotInfo } from '../report/types.js'
import { runPerfReviewRole } from '../roles/perf-review.js'
import type { CommandCliOptions } from '../runtime/types.js'
import { listScreenshots } from '../runtime/mobile.js'
import { humanizeScreenshotLabel } from '../utils.js'
import { runMobileStructuredCommand } from './shared.js'

function composePerfReviewReport(
  model: string,
  context: Parameters<typeof runPerfReviewRole>[0]['context'],
  reportInput: Awaited<ReturnType<typeof runPerfReviewRole>>['reportInput'],
  screenshots: Array<Omit<ScreenshotInfo, 'label'>>,
  agentDeviceTrace: PerfReviewReport['agentDeviceTrace'],
  reactDevtoolsTrace: PerfReviewReport['reactDevtoolsTrace']
): PerfReviewReport {
  return {
    command: 'perf-review',
    generatedAt: new Date().toISOString(),
    model,
    context,
    overallStatus: reportInput.overallStatus,
    summary: reportInput.summary,
    scenario: reportInput.scenario ?? context.perfReview?.targetFlow ?? 'General runtime review',
    slowComponents: reportInput.slowComponents ?? [],
    rerenderHotspots: reportInput.rerenderHotspots ?? [],
    suspectedCauses: reportInput.suspectedCauses ?? [],
    evidence: reportInput.evidence ?? [],
    recommendedFixes: reportInput.recommendedFixes ?? [],
    nextSteps: reportInput.nextSteps ?? [],
    environmentNotes: reportInput.environmentNotes ?? [],
    screenshots: screenshots.map((screenshot) => ({
      ...screenshot,
      label: humanizeScreenshotLabel(screenshot.fileName),
    })),
    agentDeviceTrace,
    reactDevtoolsTrace,
  }
}

function createBlockedPerfReviewReport(summary: string): Awaited<
  ReturnType<typeof runPerfReviewRole>
>['reportInput'] {
  return {
    overallStatus: 'blocked' as const,
    summary,
    scenario: 'Blocked runtime performance review',
    slowComponents: [],
    rerenderHotspots: [],
    suspectedCauses: [],
    evidence: [],
    recommendedFixes: [],
    nextSteps: ['Inspect bootstrap, runtime tooling, and retry the performance review run.'],
    environmentNotes: [summary],
  }
}

export async function runPerfReviewCommand(cli: CommandCliOptions) {
  return runMobileStructuredCommand({
    commandId: 'perf-review',
    cli,
    roleLabel: 'Perf-review',
    reportLabel: 'Perf-review report',
    createBlockedReport: createBlockedPerfReviewReport,
    composeReport: async ({ model, context, reportInput, mobileContext, traces }) => {
      const screenshots = mobileContext ? await listScreenshots(mobileContext.screenshotsDir) : []

      return composePerfReviewReport(
        model,
        context,
        reportInput,
        screenshots,
        traces.agentDeviceTrace,
        traces.reactDevtoolsTrace
      )
    },
    runRole: async ({
      context,
      modelId,
      tools,
      availableSkillsPrompt,
      preloadedSkillsPrompt,
      extraInstructions,
      prompt,
      onAgentStep,
      onAgentFinish,
    }) =>
      runPerfReviewRole({
        context,
        modelId,
        tools,
        availableSkillsPrompt,
        preloadedSkillsPrompt,
        extraInstructions,
        prompt,
        onAgentStep,
        onAgentFinish,
      }),
  })
}
