import { tryRunAdbReverse } from '@react-native-community/cli-platform-android'
import { tool } from 'ai'
import { execSync } from 'child_process'
import dedent from 'dedent'
import { EOL } from 'os'
import { z } from 'zod'

import {
  adb,
  build,
  getAdbPathString,
  getEmulators,
  getTaskNames,
  tryLaunchAppOnDevice,
  tryLaunchEmulator,
} from './vendor/react-native-cli.js'

export const getAdbPath = tool({
  description: 'Returns path to ADB executable',
  parameters: z.object({}),
  execute: async () => {
    return getAdbPathString()
  },
})

export const getAndroidDevices = tool({
  description: dedent`
    Gets available Android devices and emulators.

    Returns an array of devices:
      - "id" - device ID
      - "name" - device name
      - "type" - device type ("device" or "emulator")
      - "booted" - whether the device is booted
  `,
  parameters: z.object({
    adbPath: z.string(),
  }),
  execute: async ({ adbPath }) => {
    const devices = adb.getDevices(adbPath).map((device) => ({
      id: device,
      name: device.includes('emulator')
        ? getEmulatorName(adbPath, device)
        : getPhoneName(adbPath, device),
      type: device.includes('emulator') ? 'emulator' : 'device',
      booted: true,
    }))

    const deviceNames = devices.map((device) => device.name)
    const emulators = getEmulators()
      .filter((name) => !deviceNames.includes(name))
      .map((name) => ({
        id: undefined,
        name,
        type: 'emulator',
        booted: false,
      }))

    return [...devices, ...emulators]
  },
})

export const bootAndroidEmulator = tool({
  description: 'Boots a given Android emulator and returns its ID',
  parameters: z.object({
    adbPath: z.string(),
    androidDevice_name: z.string(),
  }),
  execute: async ({ adbPath, androidDevice_name: emulatorName }) => {
    await tryLaunchEmulator(adbPath, emulatorName)
    return {
      success: 'Device booted successfully.',
    }
  },
})

export const buildAndroidApp = tool({
  description: 'Builds Android application and install it on a given device',
  parameters: z.object({
    androidDevice_id: z.string(),
    metroPort: z.number(),
    reactNativeConfig_android_sourceDir: z.string(),
    reactNativeConfig_android_appName: z.string(),
    mode: z.enum(['debug', 'release']),
  }),
  execute: async ({
    mode,
    reactNativeConfig_android_appName: appName,
    reactNativeConfig_android_sourceDir: sourceDir,
    metroPort,
  }) => {
    // tbd: taks selection
    // tbd: user selection
    // tbd: flavor selection

    const gradleArgs = getTaskNames(appName, mode, [], 'install')
    gradleArgs.push('-x', 'lint', `-PreactNativeDevServerPort=${metroPort}`)

    // tbd: additional CLI flags, such as activeArchOnly

    build(gradleArgs, sourceDir)
    return {
      success: true,
    }
  },
})

export const runAdbReverse = tool({
  description: 'Runs "adb reverse" to forward given port to a specified Android device',
  parameters: z.object({
    androidDevice_id: z.string(),
    port: z.number(),
  }),
  execute: async ({ androidDevice_id: deviceId, port }) => {
    tryRunAdbReverse(port, deviceId)
    return {
      success: true,
    }
  },
})

export const launchAndroidAppOnDevice = tool({
  description: 'Launches a given Android application on a specified device',
  parameters: z.object({
    androidDevice_id: z.string(),
    adbPath: z.string(),
    reactNativeConfig_android_packageName: z.string(),
    reactNativeConfig_android_mainActivity: z.string(),
    reactNativeConfig_android_applicationId: z.string(),
    didForwardMetroPortToDevice: z.boolean(),
  }),
  execute: async ({
    androidDevice_id: deviceId,
    adbPath,
    reactNativeConfig_android_packageName: packageName,
    reactNativeConfig_android_mainActivity: mainActivity,
    reactNativeConfig_android_applicationId: applicationId,
    didForwardMetroPortToDevice,
  }) => {
    if (!didForwardMetroPortToDevice) {
      throw new Error('Port is not forwarded to device.')
    }

    // @ts-ignore
    tryLaunchAppOnDevice(deviceId, { packageName, mainActivity, applicationId }, adbPath, {
      appId: '',
      appIdSuffix: '',
    })
    return {
      success: true,
    }
  },
})

function getEmulatorName(adbPath: string, deviceId: string) {
  const buffer = execSync(`${adbPath} -s ${deviceId} emu avd name`)
  return buffer
    .toString()
    .split(EOL)[0]
    .replace(/(\r\n|\n|\r)/gm, '')
    .trim()
}

function getPhoneName(adbPath: string, deviceId: string) {
  const buffer = execSync(`${adbPath} -s ${deviceId} shell getprop | grep ro.product.model`)
  return buffer
    .toString()
    .replace(/\[ro\.product\.model\]:\s*\[(.*)\]/, '$1')
    .trim()
}
