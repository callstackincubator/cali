import { tool } from 'ai'
import { z } from 'zod'

import { install, installDev, uninstall } from './vendor/react-native-cli.js'

export const installNpmPackage = tool({
  description: 'Install a package from npm by name',
  parameters: z.object({
    packageNames: z.array(z.string()),
    packageManager: z.enum(['yarn', 'npm', 'bun']).optional(),
    dev: z.boolean().optional(),
  }),
  execute: async ({ packageNames, packageManager, dev }) => {
    try {
      const params = {
        packageManager: packageManager || 'npm',
        root: process.cwd(),
      }
      if (dev) {
        await installDev(packageNames, params)
      } else {
        await install(packageNames, params)
      }
      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to install package',
      }
    }
  },
})

export const unInstallNpmPackage = tool({
  description: 'Uninstall a package from npm by name',
  parameters: z.object({
    packageNames: z.array(z.string()),
    packageManager: z.enum(['yarn', 'npm', 'bun']).optional(),
  }),
  execute: async ({ packageNames, packageManager }) => {
    try {
      const params = {
        packageManager: packageManager || 'npm',
        root: process.cwd(),
      }
      await uninstall(packageNames, params)
      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to install package',
      }
    }
  },
})
