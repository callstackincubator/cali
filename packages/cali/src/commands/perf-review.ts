import type { PerfReviewReport, ScreenshotInfo } from '../report/types.js'
import { runPerfReviewRole } from '../roles/perf-review.js'
import {
  bootstrapMobileApp,
  closeAgentDeviceSession,
  createAgentDeviceSessionName,
  listScreenshots,
  prepareMobileOutputDirectories,
  resolveMobileRuntimeContext,
} from '../runtime/mobile.js'
import { publishReport } from '../runtime/publishers.js'
import { prepareToolPacks } from '../runtime/tool-packs.js'
import type { CommandCliOptions } from '../runtime/types.js'
import { humanizeScreenshotLabel } from '../utils.js'
import {
  createRunContextTool,
  formatAgentFinishDetail,
  formatAgentStepDetail,
  loadRunContext,
  printPhase,
  printFinalReport,
  summarizeReason,
} from './shared.js'

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

function createBlockedPerfReviewReport(summary: string) {
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
  const { cwd, config, context } = await loadRunContext('perf-review', cli)

  let reportInput: Awaited<ReturnType<typeof runPerfReviewRole>>['reportInput']
  let agentDeviceTrace: PerfReviewReport['agentDeviceTrace'] = []
  let reactDevtoolsTrace: PerfReviewReport['reactDevtoolsTrace'] = []
  let mobileContext: Awaited<ReturnType<typeof resolveMobileRuntimeContext>> | undefined
  let sessionName: string | undefined

  try {
    mobileContext = await resolveMobileRuntimeContext('perf-review', config.envName, context)
    sessionName = createAgentDeviceSessionName(mobileContext.platform)

    printPhase(
      'Preparing output',
      `${mobileContext.platform} | ${mobileContext.deviceName ?? 'bound device'} | ${mobileContext.appId}`
    )
    await prepareMobileOutputDirectories(mobileContext)
    printPhase('Bootstrapping app', mobileContext.artifactPath)
    await bootstrapMobileApp('perf-review', config.envName, mobileContext, sessionName)
    printPhase('Bootstrap complete')

    printPhase('Preparing tool packs', config.enabledToolPacks.join(', '))
    const preparedToolPacks = await prepareToolPacks({
      context,
      skillPaths: config.skillPaths,
      enabledToolPacks: config.enabledToolPacks,
      sessionName,
    })

    printPhase('Running perf-review agent', config.model)
    const roleResult = await runPerfReviewRole({
      context,
      modelId: config.model,
      tools: {
        ...preparedToolPacks.tools,
        get_run_context: createRunContextTool('perf-review', context),
      },
      availableSkillsPrompt: preparedToolPacks.availableSkillsPrompt,
      preloadedSkillsPrompt: preparedToolPacks.preloadedSkillsPrompt,
      extraInstructions: config.extraInstructions,
      prompt: cli.prompt,
      onAgentStep: (event) => {
        printPhase('Perf-review step complete', formatAgentStepDetail(event))
      },
      onAgentFinish: (event) => {
        printPhase('Perf-review agent finished', formatAgentFinishDetail(event))
      },
    })

    reportInput = roleResult.reportInput
    agentDeviceTrace = preparedToolPacks.traces.agentDeviceTrace
    reactDevtoolsTrace = preparedToolPacks.traces.reactDevtoolsTrace
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
    printPhase('Run blocked', summarizeReason(error.message))
    reportInput = createBlockedPerfReviewReport(error.message)
  } finally {
    if (sessionName) {
      await closeAgentDeviceSession(sessionName)
    }
  }

  const screenshots = mobileContext ? await listScreenshots(mobileContext.screenshotsDir) : []
  const report = composePerfReviewReport(
    config.model,
    context,
    reportInput,
    screenshots,
    agentDeviceTrace,
    reactDevtoolsTrace
  )
  printPhase('Publishing report', config.outputPublishers.join(', '))
  const publishedReport = await publishReport({
    report,
    publishers: config.outputPublishers,
  })

  printFinalReport(cwd, 'perf-review', 'Perf-review report', publishedReport)
}
