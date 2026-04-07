import { createHash } from 'node:crypto'
import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import type { CaliEnvName } from '../config/schema.js'
import type { ScreenshotInfo } from '../report/types.js'
import { getAgentDeviceSessionArgs } from '../tools/agent-device.js'
import { ensureCommandExists, ensureDirectory, runCommand } from '../utils.js'
import type { CaliContext, CaliPlatform, CommandId, MobileCommandRuntimeContext } from './types.js'

function buildDeviceSelectorArgs(context: { platform: CaliPlatform; deviceName?: string }) {
  const args = ['--platform', context.platform]

  if (context.deviceName) {
    args.push('--device', context.deviceName)
  }

  return args
}

function summarizeCommandFailure(result: { stdout: string; stderr: string; exitCode: number }) {
  return result.stderr || result.stdout || `Command failed with exit code ${result.exitCode}.`
}

function assertCommandSuccess(
  result: { ok: boolean; stdout: string; stderr: string; exitCode: number },
  label: string
) {
  if (result.ok) {
    return
  }

  throw new Error(`${label}\n\n${summarizeCommandFailure(result)}`)
}

async function runAgentDeviceCommand(
  command: string,
  args: string[],
  options: Parameters<typeof runCommand>[2] = {}
) {
  return runCommand('agent-device', [command, ...args], options)
}

async function runAgentDeviceSessionCommand(
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

async function readCommandStdout(file: string, args: string[]) {
  const result = await runCommand(file, args, { allowFailure: true })
  if (!result.ok) {
    return undefined
  }

  const value = result.stdout.trim()
  return value.length > 0 ? value : undefined
}

async function inferAndroidAppId(artifactPath: string) {
  const apkanalyzerValue = await readCommandStdout('apkanalyzer', [
    'manifest',
    'application-id',
    artifactPath,
  ])
  if (apkanalyzerValue) {
    return apkanalyzerValue.split('\n').at(-1)?.trim()
  }

  const aaptValue = await readCommandStdout('aapt', ['dump', 'badging', artifactPath])
  const packageName = aaptValue?.match(/package: name='([^']+)'/)?.[1]
  if (packageName) {
    return packageName
  }

  return undefined
}

async function inferIosAppId(artifactPath: string) {
  if (path.extname(artifactPath) !== '.app') {
    return undefined
  }

  const infoPlistPath = path.join(artifactPath, 'Info.plist')
  const plistBuddyValue = await readCommandStdout('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleIdentifier',
    infoPlistPath,
  ])
  if (plistBuddyValue) {
    return plistBuddyValue
  }

  return readCommandStdout('plutil', [
    '-extract',
    'CFBundleIdentifier',
    'raw',
    '-o',
    '-',
    infoPlistPath,
  ])
}

async function inferMobileAppId(platform: CaliPlatform, artifactPath: string) {
  if (platform === 'android') {
    return inferAndroidAppId(artifactPath)
  }

  return inferIosAppId(artifactPath)
}

function parseBootedDeviceNames(output: string, platform: CaliPlatform, kind: 'simulator' | 'any') {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return lines
    .filter((line) => {
      if (
        !line.includes(`(${platform}`) ||
        !line.includes('target=mobile') ||
        !line.includes('booted=true')
      ) {
        return false
      }

      if (kind === 'simulator') {
        return line.includes('(ios simulator ')
      }

      return true
    })
    .map((line) => line.replace(/\s+\([^)]*\)\s+booted=true$/, ''))
}

async function resolveLocalAndroidDeviceName(explicitDeviceName?: string) {
  if (explicitDeviceName) {
    return explicitDeviceName
  }

  const result = await runAgentDeviceCommand('devices', ['--platform', 'android'], {
    allowFailure: true,
  })
  const bootedDevices = parseBootedDeviceNames(result.stdout, 'android', 'any')

  if (bootedDevices.length === 1) {
    return bootedDevices[0]
  }

  if (bootedDevices.length > 1) {
    throw new Error(
      `local-android requires --device when more than one Android target is booted.\n\nBooted targets:\n- ${bootedDevices.join('\n- ')}`
    )
  }

  throw new Error(
    'local-android requires a booted Android device or emulator. Boot one first or pass --device so Cali can provision it deterministically.'
  )
}

async function resolveLocalIosDeviceName(explicitDeviceName?: string) {
  if (explicitDeviceName) {
    return explicitDeviceName
  }

  const result = await runAgentDeviceCommand('devices', ['--platform', 'ios'], {
    allowFailure: true,
  })
  const bootedSimulators = parseBootedDeviceNames(result.stdout, 'ios', 'simulator')

  if (bootedSimulators.length === 1) {
    return bootedSimulators[0]
  }

  if (bootedSimulators.length > 1) {
    throw new Error(
      `local-ios requires --device when more than one iOS simulator is booted.\n\nBooted simulators:\n- ${bootedSimulators.join('\n- ')}`
    )
  }

  throw new Error('local-ios requires --device or exactly one booted iOS simulator.')
}

async function ensureTargetReady(context: MobileCommandRuntimeContext) {
  if (!context.deviceName) {
    return
  }

  if (context.platform === 'ios') {
    await runAgentDeviceCommand('ensure-simulator', ['--device', context.deviceName, '--boot'])
    return
  }

  await runAgentDeviceCommand('boot', buildDeviceSelectorArgs(context), {
    allowFailure: true,
  })
}

async function openAppSession(
  sessionName: string,
  context: MobileCommandRuntimeContext,
  options: Parameters<typeof runAgentDeviceSessionCommand>[3] = {}
) {
  return runAgentDeviceSessionCommand(
    sessionName,
    'open',
    [...buildDeviceSelectorArgs(context), context.appId, '--relaunch'],
    options
  )
}

async function installFreshArtifact(
  commandId: 'qa' | 'perf-review',
  context: MobileCommandRuntimeContext
) {
  const installArgs = [...buildDeviceSelectorArgs(context), context.appId, context.artifactPath]

  if (context.platform === 'android') {
    let installResult = await runAgentDeviceCommand('install', installArgs, {
      allowFailure: true,
    })

    if (!installResult.ok) {
      installResult = await runAgentDeviceCommand('reinstall', installArgs, {
        allowFailure: true,
      })
    }

    assertCommandSuccess(
      installResult,
      `Deterministic ${commandId} bootstrap failed during install or reinstall.`
    )
    return
  }

  const reinstallResult = await runAgentDeviceCommand('reinstall', installArgs, {
    allowFailure: true,
  })
  assertCommandSuccess(
    reinstallResult,
    `Deterministic ${commandId} bootstrap failed during reinstall.`
  )
}

function isLocalEnv(envName: CaliEnvName) {
  return envName === 'local-android' || envName === 'local-ios'
}

export function createAgentDeviceSessionName(platform: CaliPlatform) {
  const hash = createHash('md5')
    .update(`${platform}:${process.cwd()}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .slice(0, 5)

  return `${platform}-${hash}`
}

export async function resolveMobileRuntimeContext(
  commandId: CommandId,
  envName: CaliEnvName,
  context: CaliContext
): Promise<MobileCommandRuntimeContext> {
  await ensureCommandExists('agent-device', 'npm i -g agent-device')
  const platform = context.mobile?.platform
  const artifactPath = context.mobile?.artifactPath
  const outputDir = context.output.outputDir

  if (!platform) {
    throw new Error(
      `${commandId} requires a mobile platform in context.mobile.platform or --platform.`
    )
  }

  if (!artifactPath) {
    throw new Error(
      `${commandId} requires a mobile artifact path in context.mobile.artifactPath or --artifact.`
    )
  }

  if (!outputDir) {
    throw new Error(`${commandId} requires an output directory.`)
  }

  const inferredAppId = await inferMobileAppId(platform, artifactPath)
  const appId = context.mobile?.appId ?? inferredAppId
  if (!appId) {
    throw new Error(
      `${commandId} requires an app id in context.mobile.appId or --app-id. Cali could not infer it from ${path.basename(artifactPath)}.`
    )
  }

  let deviceName = context.mobile?.deviceName
  if (envName === 'local-ios') {
    deviceName = await resolveLocalIosDeviceName(deviceName)
  } else if (envName === 'local-android') {
    deviceName = await resolveLocalAndroidDeviceName(deviceName)
  }

  return {
    platform,
    artifactPath,
    appId,
    deviceName,
    outputDir,
    screenshotsDir: context.output.screenshotsDir ?? path.join(outputDir, 'screenshots'),
  }
}

export async function bootstrapMobileApp(
  commandId: 'qa' | 'perf-review',
  envName: CaliEnvName,
  context: MobileCommandRuntimeContext,
  sessionName: string
) {
  await ensureTargetReady(context)

  if (isLocalEnv(envName)) {
    const openResult = await openAppSession(sessionName, context, {
      allowFailure: true,
    })

    if (openResult.ok) {
      return
    }
  }

  await installFreshArtifact(commandId, context)

  const openResult = await openAppSession(sessionName, context, {
    allowFailure: true,
  })
  assertCommandSuccess(openResult, 'Deterministic app bootstrap failed during open.')
}

export async function closeAgentDeviceSession(sessionName: string) {
  await runAgentDeviceSessionCommand(sessionName, 'close', [], {
    allowFailure: true,
  })
}

export async function prepareMobileOutputDirectories(context: MobileCommandRuntimeContext) {
  await ensureDirectory(context.outputDir)
  await rm(context.screenshotsDir, { force: true, recursive: true })
  await ensureDirectory(context.screenshotsDir)
}

export async function listScreenshots(screenshotsDir: string) {
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
