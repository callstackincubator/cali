import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { loadQaConfig } from '../config/load.js'
import { fromEasEnv } from '../env/eas.js'
import { fromGitHubActionsEnv } from '../env/github-actions.js'
import { fromJsonFile } from '../env/json-file.js'
import { fromLocalFlags } from '../env/local.js'
import type { QaCliOptions, QaRuntimeContext } from '../env/types.js'
import { publishBlobReport } from '../report/publishers/blob.js'
import { publishFileReport } from '../report/publishers/file.js'
import type { QaReport, QaReportInput, ScreenshotInfo } from '../report/types.js'
import { runQaMobileRole } from '../roles/qa-mobile.js'
import {
  DEFAULT_AGENT_DEVICE_SESSION_NAME,
  getAgentDeviceSessionArgs,
} from '../tools/agent-device.js'
import { ensureDirectory, humanizeScreenshotLabel, resolveFromCwd, runCommand } from '../utils.js'

function printPhase(title: string, detail?: string) {
  console.log(detail ? `${title}: ${detail}` : title)
}

function summarizeReason(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
}

function formatAgentStepDetail(event: {
  stepNumber: number
  finishReason: string
  toolNames: string[]
  totalTokens?: number
}) {
  const details = [`step ${event.stepNumber}`, `finish=${event.finishReason}`]

  if (event.toolNames.length > 0) {
    details.push(`tools=${event.toolNames.join(',')}`)
  }

  if (event.totalTokens != null) {
    details.push(`tokens=${event.totalTokens}`)
  }

  return details.join(' | ')
}

function formatAgentFinishDetail(event: {
  stepCount: number
  finishReason: string
  totalTokens?: number
}) {
  const details = [`steps=${event.stepCount}`, `finish=${event.finishReason}`]

  if (event.totalTokens != null) {
    details.push(`tokens=${event.totalTokens}`)
  }

  return details.join(' | ')
}

async function resolveEnvironmentContext(
  cwd: string,
  cli: QaCliOptions
): Promise<{ config: Awaited<ReturnType<typeof loadQaConfig>>; context: QaRuntimeContext }> {
  const config = await loadQaConfig({
    cwd,
    configPath: cli.configPath,
    presetName: cli.presetName,
    model: cli.model,
  })

  if (cli.jsonPath || config.environmentAdapter === 'json-file') {
    return {
      config: {
        ...config,
        environmentAdapter: 'json-file',
      },
      context: await fromJsonFile(cwd, config, cli),
    }
  }

  if (config.environmentAdapter === 'eas-env') {
    return {
      config,
      context: await fromEasEnv(cwd, config, cli),
    }
  }

  if (config.environmentAdapter === 'github-actions-env') {
    return {
      config,
      context: await fromGitHubActionsEnv(cwd, config, cli),
    }
  }

  return {
    config,
    context: await fromLocalFlags(cwd, config, cli),
  }
}

async function runAgentDeviceCommand(
  sessionName: string,
  command: string,
  args: string[],
  options: Parameters<typeof runCommand>[2] = {}
) {
  return runCommand(
    'agent-device',
    [...getAgentDeviceSessionArgs(sessionName), command, ...args],
    options
  )
}

async function bootstrapApp(context: QaRuntimeContext, sessionName: string) {
  const deviceSelectorArgs = context.deviceName
    ? ['--platform', context.platform, '--device', context.deviceName]
    : ['--platform', context.platform]

  if (context.deviceName) {
    if (context.platform === 'ios') {
      await runAgentDeviceCommand(sessionName, 'ensure-simulator', [
        ...deviceSelectorArgs,
        '--boot',
      ])
    } else {
      await runAgentDeviceCommand(sessionName, 'boot', deviceSelectorArgs)
    }
  }

  if (context.platform === 'android') {
    let installResult = await runAgentDeviceCommand(
      sessionName,
      'install',
      [...deviceSelectorArgs, context.appId, context.artifactPath],
      {
        allowFailure: true,
      }
    )

    if (!installResult.ok) {
      installResult = await runAgentDeviceCommand(
        sessionName,
        'reinstall',
        [...deviceSelectorArgs, context.appId, context.artifactPath],
        {
          allowFailure: true,
        }
      )
    }

    if (!installResult.ok) {
      throw new Error(
        `Deterministic Android bootstrap failed during install or reinstall.\n\n${installResult.stderr || installResult.stdout}`
      )
    }
  } else {
    const reinstallResult = await runAgentDeviceCommand(
      sessionName,
      'reinstall',
      [...deviceSelectorArgs, context.appId, context.artifactPath],
      {
        allowFailure: true,
      }
    )

    if (!reinstallResult.ok) {
      throw new Error(
        `Deterministic iOS bootstrap failed during reinstall.\n\n${reinstallResult.stderr || reinstallResult.stdout}`
      )
    }
  }

  const openResult = await runAgentDeviceCommand(
    sessionName,
    'open',
    [...deviceSelectorArgs, context.appId, '--relaunch'],
    {
      allowFailure: true,
    }
  )

  if (!openResult.ok) {
    throw new Error(
      `Deterministic app bootstrap failed during open.\n\n${openResult.stderr || openResult.stdout}`
    )
  }
}

async function listScreenshots(screenshotsDir: string) {
  let entries: string[]

  try {
    entries = await readdir(screenshotsDir)
  } catch {
    return []
  }

  const screenshots: Array<Omit<ScreenshotInfo, 'label'>> = []
  for (const entry of entries) {
    if (!entry.endsWith('.png')) {
      continue
    }

    const absolutePath = path.join(screenshotsDir, entry)
    const fileStat = await stat(absolutePath)
    screenshots.push({
      fileName: entry,
      absolutePath,
      bytes: fileStat.size,
    })
  }

  return screenshots.sort((left, right) => left.fileName.localeCompare(right.fileName))
}

function composeReport(
  model: string,
  context: QaRuntimeContext,
  reportInput: QaReportInput,
  screenshots: Array<Omit<ScreenshotInfo, 'label'>>,
  agentDeviceTrace: QaReport['agentDeviceTrace']
): QaReport {
  const screenshotLabelMap = new Map(
    (reportInput.screenshotLabels ?? [])
      .filter((item) => item.fileName && item.label)
      .map((item) => [item.fileName, item.label.trim()])
  )

  return {
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
  }
}

async function publishReport(report: QaReport, publishers: string[]) {
  let currentReport = report

  for (const publisher of publishers) {
    if (publisher === 'blob') {
      currentReport = await publishBlobReport({ report: currentReport })
      continue
    }

    if (publisher === 'file') {
      currentReport = await publishFileReport({ report: currentReport })
    }
  }

  return currentReport
}

export async function runQaCommand(cli: QaCliOptions) {
  const cwd = process.cwd()
  printPhase('Resolving config')
  const { config, context } = await resolveEnvironmentContext(cwd, cli)
  const sessionName = process.env.AGENT_DEVICE_SESSION ?? DEFAULT_AGENT_DEVICE_SESSION_NAME

  printPhase(
    'Preparing output',
    `${context.platform} | ${context.deviceName ?? 'bound device'} | ${context.appId}`
  )
  await ensureDirectory(context.outputDir)
  await rm(context.screenshotsDir, { force: true, recursive: true })
  await ensureDirectory(context.screenshotsDir)

  let reportInput: QaReportInput
  let agentDeviceTrace: QaReport['agentDeviceTrace'] = []

  try {
    printPhase('Bootstrapping app', context.artifactPath)
    await bootstrapApp(context, sessionName)
    printPhase('Bootstrap complete')

    printPhase('Running QA agent', config.model)
    const roleResult = await runQaMobileRole({
      context,
      modelId: config.model,
      sessionName,
      skillPaths: config.skillPaths,
      enabledToolPacks: config.enabledToolPacks,
      extraInstructions: config.extraInstructions,
      prompt: cli.prompt,
      onAgentStep: (event) => {
        printPhase('QA agent step complete', formatAgentStepDetail(event))
      },
      onAgentFinish: (event) => {
        printPhase('QA agent finished', formatAgentFinishDetail(event))
      },
    })

    reportInput = roleResult.reportInput
    agentDeviceTrace = roleResult.agentDeviceTrace
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
    printPhase('Run blocked', summarizeReason(error.message))
    reportInput = createBlockedReport(error.message)
  }

  const screenshots = await listScreenshots(context.screenshotsDir)
  const report = composeReport(config.model, context, reportInput, screenshots, agentDeviceTrace)
  printPhase('Publishing report', config.outputPublishers.join(', '))
  const publishedReport = await publishReport(report, config.outputPublishers)

  console.log(
    `QA report written to ${resolveFromCwd(cwd, path.join(context.outputDir, 'section.md'))}`
  )
  const reason = summarizeReason(publishedReport.summary)
  console.log(
    reason
      ? `Overall status: ${publishedReport.overallStatus} (${reason})`
      : `Overall status: ${publishedReport.overallStatus}`
  )
}
