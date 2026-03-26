import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { tool } from 'ai'
import { z } from 'zod'

type SkillMetadata = {
  name: string
  description: string
  directoryPath: string
  skillFilePath: string
}

function stripFrontmatter(content: string) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)
  return match ? content.slice(match[0].length).trim() : content.trim()
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
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
    throw new Error(`Skill not found: ${name}`)
  }

  return skill
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
        const frontmatter = parseFrontmatter(content)
        const key = frontmatter.name.toLowerCase()

        if (seenNames.has(key)) {
          continue
        }

        seenNames.add(key)
        skills.push({
          name: frontmatter.name,
          description: frontmatter.description,
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

export function buildSkillsPrompt(skills: SkillMetadata[]) {
  if (skills.length === 0) {
    return 'No local skills were discovered for this run.'
  }

  return [
    'Available local skills:',
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
    '',
    'Load a skill before relying on its instructions. Only read files inside a skill after loading it.',
  ].join('\n')
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

        return {
          name: skill.name,
          description: skill.description,
          skillDirectory: skill.directoryPath,
          skillFilePath: skill.skillFilePath,
          content: stripFrontmatter(content),
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

export type { SkillMetadata }
