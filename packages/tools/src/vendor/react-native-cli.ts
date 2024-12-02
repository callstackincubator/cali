/**
 * This file re-exports private internals from the RN CLI, or copies some of the private functions.
 * In the future, we should export these functions from the RN CLI package.
 */
import { execSync } from 'node:child_process'
/**
 * Export private internals. We add `.js` extension manually, since Bundler will not do it for us.
 */
export {
  install,
  installDev,
  uninstall,
} from '@react-native-community/cli/build/tools/packageManager.js'
export { build } from '@react-native-community/cli-platform-android/build/commands/buildAndroid/index.js'
export { getTaskNames } from '@react-native-community/cli-platform-android/build/commands/runAndroid/getTaskNames.js'
export { getEmulators } from '@react-native-community/cli-platform-android/build/commands/runAndroid/tryLaunchEmulator.js'
export { getPlatformInfo } from '@react-native-community/cli-platform-apple/build/commands/runCommand/getPlatformInfo.js'

/**
 * Default exports from an ESM module transpiled with Babel to CJS will not work in Node.js, when used
 * from within an ESM module.
 *
 * Source: https://esbuild.github.io/content-types/#default-interop
 */
import adbModule from '@react-native-community/cli-platform-android/build/commands/runAndroid/adb.js'
import getAdbPathStringModule from '@react-native-community/cli-platform-android/build/commands/runAndroid/getAdbPath.js'
import tryLaunchAppOnDeviceModule from '@react-native-community/cli-platform-android/build/commands/runAndroid/tryLaunchAppOnDevice.js'
import tryLaunchEmulatorModule from '@react-native-community/cli-platform-android/build/commands/runAndroid/tryLaunchEmulator.js'
import createAppleBuildModule from '@react-native-community/cli-platform-apple/build/commands/buildCommand/createBuild.js'
import createLogCommandModule from '@react-native-community/cli-platform-apple/build/commands/logCommand/createLog.js'
import createAppleRunModule from '@react-native-community/cli-platform-apple/build/commands/runCommand/createRun.js'
import listAppleDevicesModule from '@react-native-community/cli-platform-apple/build/tools/listDevices.js'

export const adb = adbModule.default
export const getAdbPathString = getAdbPathStringModule.default
export const tryLaunchAppOnDevice = tryLaunchAppOnDeviceModule.default
export const tryLaunchEmulator = tryLaunchEmulatorModule.default
export const createAppleBuild = createAppleBuildModule.default
export const createLogCommand = createLogCommandModule.default
export const createAppleRun = createAppleRunModule.default
export const listAppleDevices = listAppleDevicesModule.default

/** Export publicly-exported functions */
export {
  findDevServerPort,
  getDefaultUserTerminal,
  startServerInNewWindow,
} from '@react-native-community/cli-tools'

/** Export types */
export type { ApplePlatform } from '@react-native-community/cli-platform-apple/build/types.js'
export type { Config } from '@react-native-community/cli-types'

/** Helpers */
import { Config } from '@react-native-community/cli-types'

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
