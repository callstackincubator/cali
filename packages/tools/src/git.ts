import fs from 'node:fs'

import { tool } from 'ai'
import { applyPatch } from 'diff'
import { z } from 'zod'

export const applyDiff = tool({
  description: 'Apply a diff/patch to a file',
  parameters: z.object({
    filePath: z.string(),
    diff: z.string(),
  }),
  execute: async ({ filePath, diff }) => {
    const originalContent = fs.readFileSync(filePath, 'utf8')
    const patchedContent = applyPatch(originalContent, diff)

    if (patchedContent === false) {
      throw new Error('Failed to apply patch - patch may be invalid or not applicable')
    }

    fs.writeFileSync(filePath, patchedContent, 'utf8')

    return {
      success: true,
    }
  },
})
