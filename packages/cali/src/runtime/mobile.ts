import { createHash } from 'node:crypto'
import { access, readdir, rm, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { TextDecoder } from 'node:util'

import type { CaliEnvName } from '../config/schema.js'
import type { ScreenshotInfo } from '../report/types.js'
import { getAgentDeviceSessionArgs } from '../tools/agent-device.js'
import { ensureCommandExists, ensureDirectory, runCommand } from '../utils.js'
import type { CaliContext, CaliPlatform, CommandId, MobileCommandRuntimeContext } from './types.js'

const RES_XML_TYPE = 0x0003
const RES_STRING_POOL_TYPE = 0x0001
const RES_XML_START_ELEMENT_TYPE = 0x0102
const UTF8_FLAG = 0x100
const TYPE_STRING = 0x03
const NO_INDEX = 0xffffffff
const utf16Decoder = new TextDecoder('utf-16le')

let aaptPathCache: string | null | undefined

const AGENT_DEVICE_STATE_FILES = ['daemon.json', 'daemon.lock', 'daemon.sock', 'daemon.sock.lock']

function buildDeviceSelectorArgs(context: { platform: CaliPlatform; deviceName?: string }) {
  const args = ['--platform', context.platform]

  if (context.deviceName) {
    args.push('--device', context.deviceName)
  }

  return args
}

function buildSessionOpenArgs(context: { platform: CaliPlatform; appId: string }) {
  // Session-bound open must not re-specify the device selector once bootstrap chose the target.
  return ['--platform', context.platform, context.appId, '--relaunch']
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

function looksLikeStaleAgentDeviceState(output: string) {
  const normalized = output.toLowerCase()
  return (
    normalized.includes('stale metadata') ||
    normalized.includes('daemon.json') ||
    normalized.includes('daemon.lock') ||
    normalized.includes('stale daemon') ||
    normalized.includes('socket') ||
    normalized.includes('econnrefused')
  )
}

async function resetAgentDeviceState() {
  const stateDir = path.join(homedir(), '.agent-device')
  await Promise.all(
    AGENT_DEVICE_STATE_FILES.map((fileName) =>
      rm(path.join(stateDir, fileName), { force: true, recursive: true })
    )
  )
}

async function ensureAgentDeviceHealthy(platform: CaliPlatform) {
  const firstAttempt = await runAgentDeviceCommand('devices', ['--platform', platform], {
    allowFailure: true,
  })

  if (firstAttempt.ok) {
    return
  }

  const firstFailureOutput = [firstAttempt.stderr, firstAttempt.stdout].filter(Boolean).join('\n')
  if (!looksLikeStaleAgentDeviceState(firstFailureOutput)) {
    return
  }

  await resetAgentDeviceState()

  const retryAttempt = await runAgentDeviceCommand('devices', ['--platform', platform], {
    allowFailure: true,
  })
  if (retryAttempt.ok) {
    return
  }

  throw new Error(
    [
      'agent-device preflight failed after resetting stale daemon state.',
      summarizeCommandFailure(retryAttempt),
    ].join('\n\n')
  )
}

async function readZipEntry(archivePath: string, entry: string) {
  const result = await runCommand('unzip', ['-p', archivePath, entry], {
    allowFailure: true,
    binaryStdout: true,
  })
  if (!result.ok || !result.stdoutBuffer || result.stdoutBuffer.length === 0) {
    return undefined
  }

  return result.stdoutBuffer
}

async function ensureArtifactExists(artifactPath: string) {
  try {
    await access(artifactPath)
  } catch {
    throw new Error(`Mobile artifact does not exist: ${artifactPath}`)
  }
}

function parseTextManifestPackageName(text: string) {
  const match = text.match(/<manifest\b[^>]*\bpackage\s*=\s*["']([^"']+)["']/i)
  return match?.[1]
}

function readLength8(chunk: Buffer, offset: number): [number, number] {
  const first = chunk.readUInt8(offset)
  if ((first & 0x80) === 0) {
    return [first, 1]
  }

  const second = chunk.readUInt8(offset + 1)
  return [((first & 0x7f) << 8) | second, 2]
}

function readLength16(chunk: Buffer, offset: number): [number, number] {
  const first = chunk.readUInt16LE(offset)
  if ((first & 0x8000) === 0) {
    return [first, 2]
  }

  const second = chunk.readUInt16LE(offset + 2)
  return [((first & 0x7fff) << 16) | second, 4]
}

function readUtf8String(chunk: Buffer, offset: number) {
  const [, utf16LengthBytes] = readLength8(chunk, offset)
  const [byteLength, byteLengthBytes] = readLength8(chunk, offset + utf16LengthBytes)
  const start = offset + utf16LengthBytes + byteLengthBytes

  return chunk.subarray(start, start + byteLength).toString('utf8')
}

function readUtf16String(chunk: Buffer, offset: number) {
  const [charLength, lengthBytes] = readLength16(chunk, offset)
  const start = offset + lengthBytes

  return utf16Decoder.decode(chunk.subarray(start, start + charLength * 2))
}

function parseStringPool(chunk: Buffer) {
  if (chunk.length < 28) {
    return []
  }

  const stringCount = chunk.readUInt32LE(8)
  const flags = chunk.readUInt32LE(16)
  const stringsStart = chunk.readUInt32LE(20)
  const isUtf8 = (flags & UTF8_FLAG) !== 0
  const strings: string[] = []

  for (let index = 0; index < stringCount; index += 1) {
    const offsetPosition = 28 + index * 4
    if (offsetPosition + 4 > chunk.length) {
      return strings
    }

    const stringOffset = chunk.readUInt32LE(offsetPosition)
    const absoluteOffset = stringsStart + stringOffset
    strings.push(
      isUtf8 ? readUtf8String(chunk, absoluteOffset) : readUtf16String(chunk, absoluteOffset)
    )
  }

  return strings
}

function parseStartElementPackageName(
  buffer: Buffer,
  chunkOffset: number,
  headerSize: number,
  strings: string[]
) {
  if (headerSize < 16 || chunkOffset + headerSize + 20 > buffer.length) {
    return undefined
  }

  const nameIndex = buffer.readUInt32LE(chunkOffset + 20)
  if (strings[nameIndex] !== 'manifest') {
    return undefined
  }

  const attributeStart = buffer.readUInt16LE(chunkOffset + 24)
  const attributeSize = buffer.readUInt16LE(chunkOffset + 26)
  const attributeCount = buffer.readUInt16LE(chunkOffset + 28)
  const firstAttributeOffset = chunkOffset + headerSize + attributeStart

  for (let index = 0; index < attributeCount; index += 1) {
    const attributeOffset = firstAttributeOffset + index * attributeSize
    if (attributeOffset + 20 > buffer.length) {
      return undefined
    }

    const attributeName = strings[buffer.readUInt32LE(attributeOffset + 4)]
    if (attributeName !== 'package') {
      continue
    }

    const rawValueIndex = buffer.readUInt32LE(attributeOffset + 8)
    if (rawValueIndex !== NO_INDEX) {
      return strings[rawValueIndex]
    }

    const dataType = buffer.readUInt8(attributeOffset + 15)
    const data = buffer.readUInt32LE(attributeOffset + 16)
    if (dataType === TYPE_STRING) {
      return strings[data]
    }

    return undefined
  }

  return undefined
}

function parseBinaryManifestPackageName(buffer: Buffer) {
  if (buffer.length < 8 || buffer.readUInt16LE(0) !== RES_XML_TYPE) {
    return undefined
  }

  let strings: string[] | undefined
  for (let offset = buffer.readUInt16LE(2); offset + 8 <= buffer.length; ) {
    const type = buffer.readUInt16LE(offset)
    const headerSize = buffer.readUInt16LE(offset + 2)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    if (chunkSize <= 0 || offset + chunkSize > buffer.length) {
      return undefined
    }

    if (type === RES_STRING_POOL_TYPE) {
      strings = parseStringPool(buffer.subarray(offset, offset + chunkSize))
    } else if (type === RES_XML_START_ELEMENT_TYPE && strings) {
      const packageName = parseStartElementPackageName(buffer, offset, headerSize, strings)
      if (packageName) {
        return packageName
      }
    }

    offset += chunkSize
  }

  return undefined
}

function parseAndroidManifestPackageName(manifest: Buffer) {
  const textCandidate = manifest
    .subarray(0, Math.min(manifest.length, 128))
    .toString('utf8')
    .trimStart()

  if (textCandidate.startsWith('<')) {
    return parseTextManifestPackageName(manifest.toString('utf8'))
  }

  return parseBinaryManifestPackageName(manifest)
}

async function resolveAaptPath() {
  if (aaptPathCache !== undefined) {
    return aaptPathCache ?? undefined
  }

  const sdkRoots = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    path.join(homedir(), 'Library', 'Android', 'sdk'),
    path.join(homedir(), 'Android', 'Sdk'),
  ].filter((value): value is string => Boolean(value))

  for (const sdkRoot of sdkRoots) {
    const buildToolsDir = path.join(sdkRoot, 'build-tools')

    try {
      const versions = await readdir(buildToolsDir)
      const sortedVersions = versions.sort((left, right) =>
        right.localeCompare(left, undefined, { numeric: true })
      )

      for (const version of sortedVersions) {
        const candidate = path.join(buildToolsDir, version, 'aapt')

        try {
          await access(candidate)
          aaptPathCache = candidate
          return candidate
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }

  aaptPathCache = null
  return undefined
}

async function inferAndroidAppId(artifactPath: string) {
  for (const entry of ['AndroidManifest.xml', 'base/manifest/AndroidManifest.xml']) {
    const manifest = await readZipEntry(artifactPath, entry)
    if (!manifest) {
      continue
    }

    const packageName = parseAndroidManifestPackageName(manifest)
    if (packageName) {
      return packageName
    }
  }

  const aaptPath = await resolveAaptPath()
  if (!aaptPath) {
    return undefined
  }

  const aaptValue = await readCommandStdout(aaptPath, ['dump', 'badging', artifactPath])
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

async function findAppBundle(directory: string): Promise<string | undefined> {
  return findAppBundleAtDepth(directory, 0)
}

async function findAppBundleAtDepth(
  directory: string,
  depth: number,
  maxDepth = 3
): Promise<string | undefined> {
  if (depth > maxDepth) {
    return undefined
  }

  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory() && entry.name.endsWith('.app')) {
      return absolutePath
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const nestedPath = await findAppBundleAtDepth(path.join(directory, entry.name), depth + 1)
    if (nestedPath) {
      return nestedPath
    }
  }

  return undefined
}

async function normalizeIosArtifact(artifactPath: string, outputDir: string): Promise<string> {
  if (!artifactPath.endsWith('.app.tar.gz')) {
    return artifactPath
  }

  const extractionDir = path.join(outputDir, '_extracted_app')
  await rm(extractionDir, { recursive: true, force: true })
  await ensureDirectory(extractionDir)

  const extractResult = await runCommand('tar', ['-xzf', artifactPath, '-C', extractionDir], {
    allowFailure: true,
  })
  assertCommandSuccess(
    extractResult,
    `Failed to extract iOS artifact ${path.basename(artifactPath)}.`
  )

  const appBundlePath = await findAppBundle(extractionDir)
  if (!appBundlePath) {
    throw new Error(
      `Failed to locate a .app bundle after extracting ${path.basename(artifactPath)}.`
    )
  }

  return appBundlePath
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
  return runAgentDeviceSessionCommand(sessionName, 'open', buildSessionOpenArgs(context), options)
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

  await ensureAgentDeviceHealthy(platform)
  await ensureArtifactExists(artifactPath)

  const normalizedArtifactPath =
    platform === 'ios' ? await normalizeIosArtifact(artifactPath, outputDir) : artifactPath

  const inferredAppId = await inferMobileAppId(platform, normalizedArtifactPath)
  const appId = context.mobile?.appId ?? inferredAppId
  if (!appId) {
    throw new Error(
      `${commandId} requires an app id in context.mobile.appId or --app-id. Cali could not infer it from ${path.basename(normalizedArtifactPath)}.`
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
    artifactPath: normalizedArtifactPath,
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
