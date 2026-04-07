import type { ToolPackName } from '../config/schema.js'
import { createAgentDeviceToolPack } from '../tools/agent-device.js'
import { createGitHubToolPack } from '../tools/github.js'
import { createReactDevtoolsToolPack } from '../tools/react-devtools.js'
import { createRepoReadToolPack, createRepoWriteToolPack } from '../tools/repo.js'
import {
  buildPreloadedSkillsPrompt,
  buildSkillsPrompt,
  createSkillsToolPack,
  discoverSkills,
  preloadSkillDocuments,
  type RequiredSkillDocument,
  type SkillMetadata,
} from '../tools/skills.js'
import type { CaliContext, ToolTraceEntry } from './types.js'

type PrepareToolPacksOptions = {
  context: CaliContext
  skillPaths: string[]
  enabledToolPacks: ToolPackName[]
  sessionName?: string
}

type ToolPackState = {
  agentDeviceTrace: ToolTraceEntry[]
  reactDevtoolsTrace: ToolTraceEntry[]
}

type ToolPackDefinition = {
  requiredSkills?: RequiredSkillDocument[]
  createTools?: (context: {
    context: CaliContext
    workspaceRoot: string
    sessionName?: string
    skills: SkillMetadata[]
    state: ToolPackState
  }) => Record<string, any>
}

const TOOL_PACK_DEFINITIONS: Record<ToolPackName, ToolPackDefinition> = {
  skills: {
    createTools: ({ skills }) => createSkillsToolPack(skills),
  },
  'agent-device': {
    requiredSkills: [
      {
        name: 'agent-device',
        preloadPaths: ['SKILL.md', 'references/bootstrap-install.md', 'references/exploration.md'],
      },
    ],
    createTools: ({ state, sessionName }) =>
      createAgentDeviceToolPack({
        trace: state.agentDeviceTrace,
        sessionName: sessionName!,
      }),
  },
  'repo-read': {
    createTools: ({ workspaceRoot }) => createRepoReadToolPack({ workspaceRoot }),
  },
  'repo-write': {
    createTools: ({ workspaceRoot, context }) =>
      createRepoWriteToolPack({
        workspaceRoot,
        allowedCommands: context.dev?.allowedValidations ?? [],
      }),
  },
  github: {
    createTools: ({ context }) => createGitHubToolPack({ context }),
  },
  'react-devtools': {
    requiredSkills: [
      {
        name: 'react-devtools',
        preloadPaths: ['SKILL.md'],
      },
    ],
    createTools: ({ state }) => createReactDevtoolsToolPack({ trace: state.reactDevtoolsTrace }),
  },
  report: {},
}

export async function prepareToolPacks(options: PrepareToolPacksOptions) {
  const { context, skillPaths, enabledToolPacks, sessionName } = options
  if (enabledToolPacks.includes('agent-device') && !sessionName) {
    throw new Error('agent-device tool pack requires a bound session name.')
  }
  const skills = await discoverSkills(skillPaths)
  const state: ToolPackState = {
    agentDeviceTrace: [],
    reactDevtoolsTrace: [],
  }
  const requiredSkills = enabledToolPacks.flatMap(
    (toolPackName) => TOOL_PACK_DEFINITIONS[toolPackName].requiredSkills ?? []
  )
  const preloadedSkillDocuments = await preloadSkillDocuments(skills, requiredSkills)
  const preloadedSkillNames = [
    ...new Set(requiredSkills.map((requiredSkill) => requiredSkill.name)),
  ]
  const tools = enabledToolPacks.reduce<Record<string, any>>((accumulator, toolPackName) => {
    const toolPack = TOOL_PACK_DEFINITIONS[toolPackName]

    if (!toolPack.createTools) {
      return accumulator
    }

    return {
      ...accumulator,
      ...toolPack.createTools({
        context,
        workspaceRoot: context.workspaceRoot,
        sessionName,
        skills,
        state,
      }),
    }
  }, {})

  return {
    tools,
    skills,
    preloadedSkillDocuments,
    preloadedSkillsPrompt: buildPreloadedSkillsPrompt(preloadedSkillDocuments),
    availableSkillsPrompt: buildSkillsPrompt(skills, { excludeSkillNames: preloadedSkillNames }),
    traces: state,
  }
}
