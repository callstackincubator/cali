/**
 * This file re-exports private internals from the RN CLI, or copies some of the private functions.
 * In the future, we should export these functions from the RN CLI package.
 */
import { execSync } from 'child_process'
import { EOL } from 'os'

export { default as adb } from '@react-native-community/cli-platform-android/build/commands/runAndroid/adb'
export { default as getAdbPathString } from '@react-native-community/cli-platform-android/build/commands/runAndroid/getAdbPath'
export {
  getEmulators,
  default as tryLaunchEmulator,
} from '@react-native-community/cli-platform-android/build/commands/runAndroid/tryLaunchEmulator'

import { Config } from '@react-native-community/cli-types'

export function getEmulatorName(adbPath: string, deviceId: string) {
  const buffer = execSync(`${adbPath} -s ${deviceId} emu avd name`)
  return buffer
    .toString()
    .split(EOL)[0]
    .replace(/(\r\n|\n|\r)/gm, '')
    .trim()
}

export function getPhoneName(adbPath: string, deviceId: string) {
  const buffer = execSync(`${adbPath} -s ${deviceId} shell getprop | grep ro.product.model`)
  return buffer
    .toString()
    .replace(/\[ro\.product\.model\]:\s*\[(.*)\]/, '$1')
    .trim()
}

// Cache for React Native config
let reactNativeConfigCache: Config | null = null

export async function loadReactNativeConfig(): Promise<Config> {
  // Return cached config if available
  if (reactNativeConfigCache !== null) {
    return reactNativeConfigCache
  }
  try {
    const output = execSync('npx react-native config', {
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
      },
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).toString()

    // Store the parsed output in cache
    reactNativeConfigCache = JSON.parse(output) as Config
    return reactNativeConfigCache
  } catch (error) {
    throw new Error(`Failed to load React Native config. Error: ${error}`)
  }
}

// Optional: Add a method to clear the cache if needed
export function clearReactNativeConfigCache() {
  reactNativeConfigCache = null
}

export {
  install,
  installDev,
  uninstall,
} from '@react-native-community/cli/build/tools/packageManager'
export { build } from '@react-native-community/cli-platform-android/build/commands/buildAndroid'
export { getTaskNames } from '@react-native-community/cli-platform-android/build/commands/runAndroid/getTaskNames'
export { default as tryLaunchAppOnDevice } from '@react-native-community/cli-platform-android/build/commands/runAndroid/tryLaunchAppOnDevice'
export { default as createAppleBuild } from '@react-native-community/cli-platform-apple/build/commands/buildCommand/createBuild'
export { default as createLogCommand } from '@react-native-community/cli-platform-apple/build/commands/logCommand/createLog'
export { default as createAppleRun } from '@react-native-community/cli-platform-apple/build/commands/runCommand/createRun'
export { getPlatformInfo } from '@react-native-community/cli-platform-apple/build/commands/runCommand/getPlatformInfo'
export { default as listAppleDevices } from '@react-native-community/cli-platform-apple/build/tools/listDevices'
export type { ApplePlatform } from '@react-native-community/cli-platform-apple/build/types'
