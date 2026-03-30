import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { loadQaConfig } from '../config/load.js'
import { fromEasEnv } from '../env/eas.js'
import { fromJsonFile } from '../env/json-file.js'
import { fromLocalFlags } from '../env/local.js'
import type { QaCliOptions, QaRuntimeContext } from '../env/types.js'
import { publishBlobReport } from '../report/publishers/blob.js'
import { publishFileReport } from '../report/publishers/file.js'
import type { QaReport, QaReportInput, ScreenshotInfo } from '../report/types.js'
import { runQaMobileRole } from '../roles/qa-mobile.js'
import { ensureDirectory, humanizeScreenshotLabel, resolveFromCwd, runCommand } from '../utils.js'

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

  return {
    config,
    context: await fromLocalFlags(cwd, config, cli),
  }
}

async function bootstrapApp(context: QaRuntimeContext) {
  const deviceSelectorArgs = context.deviceName
    ? ['--platform', context.platform, '--device', context.deviceName]
    : ['--platform', context.platform]

  if (context.deviceName) {
    if (context.platform === 'ios') {
      await runCommand('agent-device', ['ensure-simulator', ...deviceSelectorArgs, '--boot'])
    } else {
      await runCommand('agent-device', ['boot', ...deviceSelectorArgs])
    }
  }

  if (context.platform === 'android') {
    let installResult = await runCommand(
      'agent-device',
      ['install', ...deviceSelectorArgs, context.appId, context.artifactPath],
      {
        allowFailure: true,
      }
    )

    if (!installResult.ok) {
      installResult = await runCommand(
        'agent-device',
        ['reinstall', ...deviceSelectorArgs, context.appId, context.artifactPath],
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
    const reinstallResult = await runCommand(
      'agent-device',
      ['reinstall', ...deviceSelectorArgs, context.appId, context.artifactPath],
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

  const openResult = await runCommand(
    'agent-device',
    ['open', ...deviceSelectorArgs, context.appId, '--relaunch'],
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
  const { config, context } = await resolveEnvironmentContext(cwd, cli)

  await ensureDirectory(context.outputDir)
  await ensureDirectory(context.screenshotsDir)

  let reportInput: QaReportInput
  let agentDeviceTrace: QaReport['agentDeviceTrace'] = []

  try {
    await bootstrapApp(context)
    const roleResult = await runQaMobileRole({
      context,
      modelId: config.model,
      skillPaths: config.skillPaths,
      enabledToolPacks: config.enabledToolPacks,
      extraInstructions: config.extraInstructions,
      prompt: cli.prompt,
    })

    reportInput = roleResult.reportInput
    agentDeviceTrace = roleResult.agentDeviceTrace
  } catch (unknownError) {
    const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
    reportInput = createBlockedReport(error.message)
  }

  const screenshots = await listScreenshots(context.screenshotsDir)
  const report = composeReport(config.model, context, reportInput, screenshots, agentDeviceTrace)
  const publishedReport = await publishReport(report, config.outputPublishers)

  console.log(
    `QA report written to ${resolveFromCwd(cwd, path.join(context.outputDir, 'section.md'))}`
  )
  console.log(`Overall status: ${publishedReport.overallStatus}`)
}
