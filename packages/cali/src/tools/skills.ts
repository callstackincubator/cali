import { access, cp, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { tool } from 'ai'
import { z } from 'zod'

import { DOCS_URLS } from '../docs.js'
import { ensureCommandExists, ensureDirectory, runCommand, uniqueStrings } from '../utils.js'

type SkillMetadata = {
  name: string
  description: string
  directoryPath: string
  skillFilePath: string
}

type PreloadedSkillDocument = {
  skillName: string
  relativePath: string
  absolutePath: string
  content: string
}

type RequiredSkillDocument = {
  name: string
  preloadPaths: string[]
}

type SkillInstallSpec = {
  packageSource: string
  skillName: string
}

const SKILL_INSTALL_SPECS: Record<string, SkillInstallSpec> = {
  'agent-device': {
    packageSource: 'callstackincubator/agent-device',
    skillName: 'agent-device',
  },
  'react-devtools': {
    packageSource: 'callstackincubator/agent-skills',
    skillName: 'react-devtools',
  },
}

function buildSkillInstallCommand(name: string) {
  const spec = SKILL_INSTALL_SPECS[name]
  if (!spec) {
    return undefined
  }

  return `npx skills add ${spec.packageSource} --agent codex --skill ${spec.skillName} --copy -y`
}

function parseSkillFile(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)/)
  if (!match?.[1]) {
    throw new Error('No frontmatter found')
  }

  const frontmatter = match[1]
  const name = frontmatter
    .match(/^name:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
  const description = frontmatter
    .match(/^description:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '')

  if (!name || !description) {
    throw new Error('Skill frontmatter is missing name or description')
  }

  return {
    name,
    description,
    body: (match[2] ?? '').trim(),
  }
}

function resolveSkillFilePath(skill: SkillMetadata, relativeFilePath: string) {
  const absolutePath = path.resolve(skill.directoryPath, relativeFilePath)
  const relativePath = path.relative(skill.directoryPath, absolutePath)
  const normalizedRelativePath = relativePath.split(path.sep).join('/')

  if (
    normalizedRelativePath === '' ||
    normalizedRelativePath.startsWith('../') ||
    normalizedRelativePath === '..'
  ) {
    throw new Error(`Refusing to read a path outside the skill directory: ${relativeFilePath}`)
  }

  return absolutePath
}

function findSkill(skills: SkillMetadata[], name: string) {
  const skill = skills.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase())
  if (!skill) {
    const installHint = buildSkillInstallCommand(name)
    throw new Error(
      [
        `Skill not found: ${name}`,
        installHint ? 'Install it before running Cali:' : undefined,
        installHint,
        `Docs: ${DOCS_URLS.requiredSkills}`,
      ]
        .filter(Boolean)
        .join('\n\n')
    )
  }

  return skill
}

async function readSkillDocument(skill: SkillMetadata, relativeFilePath: string) {
  const absolutePath =
    relativeFilePath === 'SKILL.md'
      ? skill.skillFilePath
      : resolveSkillFilePath(skill, relativeFilePath)
  const content = await readFile(absolutePath, 'utf8')

  return {
    skillName: skill.name,
    relativePath: relativeFilePath,
    absolutePath,
    content: relativeFilePath === 'SKILL.md' ? parseSkillFile(content).body : content.trim(),
  } satisfies PreloadedSkillDocument
}

export async function discoverSkills(directories: string[]) {
  const skills: SkillMetadata[] = []
  const seenNames = new Set<string>()

  for (const directory of directories) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const skillDirectoryPath = path.join(directory, entry.name)
      const skillFilePath = path.join(skillDirectoryPath, 'SKILL.md')

      try {
        const content = await readFile(skillFilePath, 'utf8')
        const skillFile = parseSkillFile(content)
        const key = skillFile.name.toLowerCase()

        if (seenNames.has(key)) {
          continue
        }

        seenNames.add(key)
        skills.push({
          name: skillFile.name,
          description: skillFile.description,
          directoryPath: skillDirectoryPath,
          skillFilePath,
        })
      } catch {
        continue
      }
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name))
}

export function buildSkillsPrompt(
  skills: SkillMetadata[],
  options?: { excludeSkillNames?: string[] }
) {
  const excludedSkillNames = new Set(
    (options?.excludeSkillNames ?? []).map((skillName) => skillName.toLowerCase())
  )
  const availableSkills = skills.filter(
    (skill) => !excludedSkillNames.has(skill.name.toLowerCase())
  )

  if (availableSkills.length === 0) {
    return 'No local skills were discovered for this run.'
  }

  return [
    'Available local skills:',
    ...availableSkills.map((skill) => `- ${skill.name}: ${skill.description}`),
    '',
    'These skills are not loaded yet. Call load_skill before relying on their instructions. Only read files inside a skill after loading it.',
  ].join('\n')
}

export async function preloadSkillDocuments(
  skills: SkillMetadata[],
  requiredSkills: RequiredSkillDocument[]
) {
  const documents: PreloadedSkillDocument[] = []

  for (const requiredSkill of requiredSkills) {
    const skill = findSkill(skills, requiredSkill.name)

    for (const preloadPath of requiredSkill.preloadPaths) {
      documents.push(await readSkillDocument(skill, preloadPath))
    }
  }

  return documents
}

export function getManagedSkillPaths(cwd: string) {
  return uniqueStrings([
    path.join(os.homedir(), '.cali', 'skills'),
    path.join(cwd, '.cali', 'skills'),
  ])
}

async function installRequiredSkill(targetDirectories: string[], skillName: string) {
  const spec = SKILL_INSTALL_SPECS[skillName]
  if (!spec) {
    throw new Error(`No managed install spec found for required skill: ${skillName}`)
  }

  await ensureCommandExists('npx', 'Install Node.js and npm so `npx skills` is available.')

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'cali-skill-'))

  try {
    const installResult = await runCommand(
      'npx',
      [
        'skills',
        'add',
        spec.packageSource,
        '--agent',
        'codex',
        '--skill',
        spec.skillName,
        '--copy',
        '-y',
      ],
      { cwd: temporaryRoot, allowFailure: true }
    )

    if (!installResult.ok) {
      throw new Error(
        [
          `Failed to install required skill: ${skillName}`,
          installResult.stderr || installResult.stdout,
          `Try manually: ${buildSkillInstallCommand(skillName)}`,
        ]
          .filter(Boolean)
          .join('\n\n')
      )
    }

    const sourceDirectory = path.join(temporaryRoot, '.agents', 'skills', spec.skillName)
    await access(sourceDirectory)

    let lastCopyError: unknown

    for (const targetDirectory of targetDirectories) {
      try {
        await ensureDirectory(targetDirectory)
        const targetSkillDirectory = path.join(targetDirectory, spec.skillName)
        await rm(targetSkillDirectory, { recursive: true, force: true })
        await cp(sourceDirectory, targetSkillDirectory, { recursive: true })
        return targetSkillDirectory
      } catch (error) {
        lastCopyError = error
      }
    }

    throw new Error(
      [
        `Installed required skill ${skillName}, but failed to place it in a managed Cali skills directory.`,
        lastCopyError instanceof Error ? lastCopyError.message : String(lastCopyError),
      ].join('\n\n')
    )
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

export async function ensureRequiredSkillsInstalled(
  cwd: string,
  directories: string[],
  requiredSkills: RequiredSkillDocument[],
  discoveredSkills: SkillMetadata[]
) {
  const missingSkillNames = [
    ...new Set(
      requiredSkills
        .map((requiredSkill) => requiredSkill.name)
        .filter(
          (name) =>
            !discoveredSkills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())
        )
    ),
  ]

  if (missingSkillNames.length === 0) {
    return discoveredSkills
  }

  const managedSkillDirectories = getManagedSkillPaths(cwd)

  for (const missingSkillName of missingSkillNames) {
    console.log(`Installing required Cali skill: ${missingSkillName}`)
    await installRequiredSkill(managedSkillDirectories, missingSkillName)
  }

  return discoverSkills(directories)
}

export function buildPreloadedSkillsPrompt(documents: PreloadedSkillDocument[]) {
  if (documents.length === 0) {
    return ''
  }

  const preloadedSkillNames = [...new Set(documents.map((document) => document.skillName))]
  const sections = [
    'Required skill guidance loaded for this run.',
    `Already loaded skills: ${preloadedSkillNames.join(', ')}`,
  ]

  for (const document of documents) {
    sections.push('', `## ${document.skillName} :: ${document.relativePath}`, document.content)
  }

  return sections.join('\n')
}

export function createSkillsToolPack(skills: SkillMetadata[]) {
  const loadedSkills = new Set<string>()
  const loadSkillInputSchema = z.object({
    name: z.string().describe('Skill name from the available local skills list.'),
  })
  const readSkillFileInputSchema = z.object({
    skillName: z.string(),
    path: z.string(),
    startLine: z.number().int().min(1).optional(),
    maxLines: z.number().int().min(1).max(400).optional(),
  })

  return {
    load_skill: tool({
      description: 'Load a local skill and return its instructions plus the skill directory path.',
      inputSchema: loadSkillInputSchema,
      execute: async ({ name }) => {
        const skill = findSkill(skills, name)
        loadedSkills.add(skill.name.toLowerCase())
        const content = await readFile(skill.skillFilePath, 'utf8')
        const skillFile = parseSkillFile(content)

        return {
          name: skill.name,
          description: skill.description,
          skillDirectory: skill.directoryPath,
          skillFilePath: skill.skillFilePath,
          content: skillFile.body,
        }
      },
    }),
    read_skill_file: tool({
      description: 'Read a text file inside a previously loaded skill directory.',
      inputSchema: readSkillFileInputSchema,
      execute: async ({ skillName, path: relativeFilePath, startLine = 1, maxLines = 200 }) => {
        const skill = findSkill(skills, skillName)
        if (!loadedSkills.has(skill.name.toLowerCase())) {
          throw new Error(`Skill must be loaded before reading files: ${skill.name}`)
        }

        const absolutePath = resolveSkillFilePath(skill, relativeFilePath)
        const content = await readFile(absolutePath, 'utf8')
        const lines = content.split('\n')
        const slice = lines.slice(Math.max(startLine - 1, 0), Math.max(startLine - 1, 0) + maxLines)

        return {
          skillName: skill.name,
          absolutePath,
          startLine,
          endLine: startLine + slice.length - 1,
          content: slice.join('\n'),
        }
      },
    }),
  }
}

export type { PreloadedSkillDocument, RequiredSkillDocument, SkillMetadata }
