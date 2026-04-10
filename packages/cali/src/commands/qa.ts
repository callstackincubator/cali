import type { QaReport, QaReportInput, ScreenshotInfo } from '../report/types.js'
import { runQaMobileRole } from '../roles/qa-mobile.js'
import { listScreenshots } from '../runtime/mobile.js'
import type { CommandCliOptions } from '../runtime/types.js'
import { humanizeScreenshotLabel } from '../utils.js'
import { runMobileStructuredCommand } from './shared.js'

function resolveAcceptanceCriteria(
  context: Parameters<typeof runQaMobileRole>[0]['context'],
  prompt?: string
) {
  if ((context.qa?.acceptanceCriteria ?? []).length > 0) {
    return context.qa?.acceptanceCriteria ?? []
  }

  if (context.pullRequest?.body?.trim()) {
    return [context.pullRequest.body.trim()]
  }

  if (context.task?.body?.trim()) {
    return [context.task.body.trim()]
  }

  if (prompt?.trim()) {
    return [prompt.trim()]
  }

  return ['Run a lightweight mobile QA pass and report the observed result.']
}

function composeQaReport(
  model: string,
  context: Parameters<typeof runQaMobileRole>[0]['context'],
  reportInput: QaReportInput,
  screenshots: Array<Omit<ScreenshotInfo, 'label'>>,
  agentDeviceTrace: QaReport['agentDeviceTrace'],
  acceptanceCriteriaUsed: string[]
): QaReport {
  const screenshotLabelMap = new Map(
    (reportInput.screenshotLabels ?? [])
      .filter((item) => item.fileName && item.label)
      .map((item) => [item.fileName, item.label.trim()])
  )

  return {
    command: 'qa',
    generatedAt: new Date().toISOString(),
    model,
    context,
    overallStatus: reportInput.overallStatus,
    summary: reportInput.summary,
    checked: reportInput.checked ?? [],
    issues: reportInput.issues ?? [],
    nextSteps: reportInput.nextSteps ?? [],
    screenshotLabels: reportInput.screenshotLabels ?? [],
    screenshots: screenshots.map((screenshot) => ({
      ...screenshot,
      label:
        screenshotLabelMap.get(screenshot.fileName) ?? humanizeScreenshotLabel(screenshot.fileName),
    })),
    acceptanceCriteriaUsed,
    environmentNotes: reportInput.environmentNotes ?? [],
    agentDeviceTrace: agentDeviceTrace.slice(-20),
  }
}

function createBlockedReport(summary: string): QaReportInput {
  return {
    overallStatus: 'blocked',
    summary,
    checked: ['Run a mobile QA pass'],
    issues: [summary],
    nextSteps: ['Inspect the bootstrap and runtime logs, then retry the QA run.'],
    environmentNotes: [summary],
  }
}

export async function runQaCommand(cli: CommandCliOptions) {
  if (cli.envName === 'mobile-pr' || cli.envName === 'eas-mobile-pr') {
    throw new Error(
      '`cali qa` no longer supports `--env mobile-pr` or `--env eas-mobile-pr`. Use `--ci github-actions` or `--ci eas` for CI runs, or `--env local-android` / `--env local-ios` for local runs.'
    )
  }

  let acceptanceCriteriaUsed: string[] | undefined

  return runMobileStructuredCommand({
    commandId: 'qa',
    cli,
    roleLabel: 'QA',
    reportLabel: 'QA report',
    createBlockedReport,
    composeReport: async ({ model, context, reportInput, mobileContext, traces }) => {
      const screenshots = mobileContext ? await listScreenshots(mobileContext.screenshotsDir) : []

      return composeQaReport(
        model,
        context,
        reportInput,
        screenshots,
        traces.agentDeviceTrace,
        acceptanceCriteriaUsed ?? resolveAcceptanceCriteria(context, cli.prompt)
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
    }) => {
      acceptanceCriteriaUsed = resolveAcceptanceCriteria(context, cli.prompt)

      return runQaMobileRole({
        context,
        modelId,
        tools,
        availableSkillsPrompt,
        preloadedSkillsPrompt,
        extraInstructions,
        prompt,
        acceptanceCriteriaUsed,
        onAgentStep,
        onAgentFinish,
      })
    },
  })
}
