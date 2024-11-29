import { tool } from 'ai'
import { execSync } from 'child_process'
import { applyPatch } from 'diff'
import fs from 'fs'
import { z } from 'zod'

import { install, installDev, uninstall } from './vendor-rncli'

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
        error: error instanceof Error ? error.message : 'Failed to uninstall package',
      }
    }
  },
})

export const getFileTree = tool({
  description:
    'Get user file tree, can be used to determine the package.json location, package manager, etc.',
  parameters: z.object({
    depth: z.number().optional().default(1),
  }),
  execute: async ({ depth }) => {
    try {
      const output = execSync(`tree -J -I "node_modules|cache|*.pyc" -L ${depth}`, {
        cwd: process.cwd(),
      }).toString()
      const fileTree = JSON.parse(output)

      return {
        success: true,
        fileTree,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to get file tree',
      }
    }
  },
})

export const readFile = tool({
  description: 'Read file, can be used to read package.json, etc.',
  parameters: z.object({
    filePath: z.string(),
    encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
  }),
  execute: async ({ filePath, encoding }) => {
    try {
      const content = fs.readFileSync(filePath, encoding)

      return {
        success: true,
        file: content,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to read file',
      }
    }
  },
})

export const applyDiff = tool({
  description: 'Apply a diff/patch to a file',
  parameters: z.object({
    filePath: z.string(),
    diff: z.string(),
  }),
  execute: async ({ filePath, diff }) => {
    try {
      const originalContent = fs.readFileSync(filePath, 'utf8')
      const patchedContent = applyPatch(originalContent, diff)

      if (patchedContent === false) {
        throw new Error('Failed to apply patch - patch may be invalid or not applicable')
      }

      fs.writeFileSync(filePath, patchedContent, 'utf8')

      return {
        success: true,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to apply diff',
      }
    }
  },
})
