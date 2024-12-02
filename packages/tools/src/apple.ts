import { tool } from 'ai'
import { execSync } from 'child_process'
import { z } from 'zod'

import {
  ApplePlatform,
  createAppleBuild,
  createAppleRun,
  createLogCommand,
  getPlatformInfo,
  listAppleDevices,
  loadReactNativeConfig,
} from './vendor/react-native-cli.js'

const platforms = ['ios', 'tvos', 'visionos'] as const

export const getAppleSimulators = tool({
  description: 'Gets available simulators',
  parameters: z.object({
    platform: z.enum(platforms),
  }),
  execute: async ({ platform }) => {
    const sdkNames = getPlatformInfo(platform as ApplePlatform).sdkNames
    return listAppleDevices(sdkNames)
  },
})

export const installRubyGems = tool({
  description: 'Install Ruby gems, including CocoaPods',
  parameters: z.object({}),
  execute: async () => {
    execSync('bundle install --path vendor/bundle', { stdio: 'inherit' })
    return {
      success: true,
    }
  },
})

export const bootAppleSimulator = tool({
  description: 'Boots iOS simulator',
  parameters: z.object({
    deviceId: z.string(),
  }),
  execute: async ({ deviceId }) => {
    try {
      execSync(`xcrun simctl boot ${deviceId}`, { stdio: 'inherit' })
      return {
        success: `Device ${deviceId} booted successfully.`,
      }
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : `Failed to boot simulator with ID ${deviceId}`,
      }
    }
  },
})

export const buildAppleAppWithoutStarting = tool({
  description: 'Build application for Apple platforms without running it',
  parameters: z.object({
    platform: z.enum(platforms),
    configuration: z.enum(['Debug', 'Release']),
    mode: z.string().optional(),
    target: z.string().optional(),
    verbose: z.boolean().optional(),
    scheme: z.string().optional(),
    xcconfig: z.string().optional(),
    buildFolder: z.string().optional(),
    interactive: z.boolean().optional(),
    destination: z.string().optional(),
    extraParams: z.array(z.string()).optional(),
    forcePods: z.boolean().optional(),
    clean: z.boolean().optional().default(false),
  }),
  execute: async ({ platform, ...params }) => {
    const config = await loadReactNativeConfig()
    const build = createAppleBuild({ platformName: platform })
    try {
      await build([], config, params)
      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to build application',
      }
    }
  },
})

export const buildStartAppleApp = tool({
  description: 'Build and start Apple application on simulator or device',
  parameters: z.object({
    platform: z.enum(platforms),
    simulator: z.string().optional(),
    device: z.union([z.string(), z.literal(true)]).optional(),
    udid: z.string().optional(),
    binaryPath: z.string().optional(),
    listDevices: z.boolean().optional(),
    packager: z.boolean().optional(),
    port: z.number(),
    terminal: z.string().optional(),
    clean: z.boolean().optional().default(false),
  }),
  execute: async ({ platform, ...params }) => {
    const run = createAppleRun({ platformName: platform })

    try {
      const config = await loadReactNativeConfig()
      await run([], config, params)
      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to start application',
      }
    }
  },
})

export const installPods = tool({
  description: 'Install CocoaPods dependencies',
  parameters: z.object({
    platform: z.enum(platforms),
    clean: z.boolean().optional().default(false),
    newArchitecture: z.boolean().optional(),
  }),
  execute: async ({ newArchitecture, platform, clean }) => {
    try {
      const config = await loadReactNativeConfig()
      const directory = config.project?.[platform]?.sourceDir ?? 'ios'

      if (!directory) {
        return {
          error: 'Project directory not found',
        }
      }

      if (clean) {
        execSync('rm -rf Pods Podfile.lock build', {
          cwd: directory,
          stdio: 'inherit',
        })
      }

      const commands = ['bundle exec pod install']

      for (const command of commands) {
        execSync(command, {
          cwd: directory,
          stdio: 'inherit',
          env: {
            ...process.env,
            ...(newArchitecture ? { RCT_NEW_ARCH_ENABLED: '1' } : {}),
          },
        })
      }

      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to install pods',
      }
    }
  },
})

export const startAppleLogging = tool({
  description: 'Start Apple gathering logs from simulator or device',
  parameters: z.object({
    platform: z.enum(platforms),
    interactive: z.boolean().optional().default(true),
  }),
  execute: async ({ platform, ...params }) => {
    try {
      const config = await loadReactNativeConfig()
      const log = createLogCommand({ platformName: platform })
      await log([], config, params)
      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to start logging',
      }
    }
  },
})
