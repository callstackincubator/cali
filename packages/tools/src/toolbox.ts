import { tool } from 'ai'
import { z } from 'zod'

import * as androidToolset from './android.js'
import * as appleToolset from './apple.js'
import * as fileSystemToolset from './fs.js'
import * as gitToolset from './git.js'
import * as npmToolset from './npm.js'
import * as reactNativeToolset from './react-native.js'

const toolsets = ['android', 'apple', 'file_system', 'git', 'npm', 'react_native'] as const

export const toolbox = {
  android: androidToolset,
  apple: appleToolset,
  file_system: fileSystemToolset,
  git: gitToolset,
  npm: npmToolset,
  react_native: reactNativeToolset,
}

export type ToolHand = {
  activeTool: (typeof toolsets)[number] | null
}

export const prepareToolbox = (toolhand: ToolHand) =>
  tool({
    description: 'Gather new toolset, after using that function you need to start new session.',
    parameters: z.object({
      tool_to_gather: z.enum(toolsets).describe('Tool you need for current job'),
    }),
    execute: async ({ tool_to_gather }) => {
      toolhand.activeTool = tool_to_gather
      // gatheringTools = true

      return 'Toolset gathered, start a new session'
    },
  })
