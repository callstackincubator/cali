import type { ToolPackName } from '../config/schema.js'
import { createAgentDeviceToolPack } from '../tools/agent-device.js'
import { createReactDevtoolsToolPack } from '../tools/react-devtools.js'
import { createRepoReadToolPack, createRepoWriteToolPack } from '../tools/repo.js'
import {
  buildPreloadedSkillsPrompt,
  buildSkillsPrompt,
  createSkillsToolPack,
  discoverSkills,
  ensureRequiredSkillsInstalled,
  getManagedSkillPaths,
  preloadSkillDocuments,
  type RequiredSkillDocument,
  type SkillMetadata,
} from '../tools/skills.js'
import { ensureCommandExists } from '../utils.js'
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
  ensureAvailable?: () => Promise<void>
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
    ensureAvailable: () => ensureCommandExists('agent-device', 'npm i -g agent-device'),
    requiredSkills: [
      {
        name: 'agent-device',
        preloadPaths: ['SKILL.md', 'references/bootstrap-install.md', 'references/exploration.md'],
      },
    ],
    createTools: ({ context, state, sessionName }) =>
      createAgentDeviceToolPack({
        trace: state.agentDeviceTrace,
        sessionName: sessionName!,
        screenshotsDir: context.output.screenshotsDir ?? 'screenshots',
      }),
  },
  'repo-read': {
    ensureAvailable: async () => {
      await ensureCommandExists('git', 'Install Git and make sure `git` is on PATH.')
      await ensureCommandExists('rg', 'Install ripgrep and make sure `rg` is on PATH.')
    },
    createTools: ({ workspaceRoot }) => createRepoReadToolPack({ workspaceRoot }),
  },
  'repo-write': {
    ensureAvailable: () =>
      ensureCommandExists(
        'zsh',
        'Install zsh and make sure `zsh` is on PATH for repository commands.'
      ),
    createTools: ({ workspaceRoot, context }) =>
      createRepoWriteToolPack({
        workspaceRoot,
        allowedCommands: context.dev?.allowedValidations ?? [],
      }),
  },
  'react-devtools': {
    ensureAvailable: () =>
      ensureCommandExists('agent-react-devtools', 'npm i -g agent-react-devtools'),
    requiredSkills: [
      {
        name: 'react-devtools',
        preloadPaths: ['SKILL.md'],
      },
    ],
    createTools: ({ state }) => createReactDevtoolsToolPack({ trace: state.reactDevtoolsTrace }),
  },
}

export async function prepareToolPacks(options: PrepareToolPacksOptions) {
  const { context, skillPaths, enabledToolPacks, sessionName } = options
  if (enabledToolPacks.includes('agent-device') && !sessionName) {
    throw new Error('agent-device tool pack requires a bound session name.')
  }
  const discoveredSkillPaths = [...getManagedSkillPaths(process.cwd()), ...skillPaths]
  await Promise.all(
    enabledToolPacks.map(async (toolPackName) => {
      await TOOL_PACK_DEFINITIONS[toolPackName].ensureAvailable?.()
    })
  )
  const state: ToolPackState = {
    agentDeviceTrace: [],
    reactDevtoolsTrace: [],
  }
  const requiredSkills = enabledToolPacks.flatMap(
    (toolPackName) => TOOL_PACK_DEFINITIONS[toolPackName].requiredSkills ?? []
  )
  const skills = await ensureRequiredSkillsInstalled(
    process.cwd(),
    discoveredSkillPaths,
    requiredSkills,
    await discoverSkills(discoveredSkillPaths)
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
