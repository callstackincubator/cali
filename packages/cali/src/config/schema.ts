import { z } from 'zod'

const CaliEnvNameSchema = z.enum(['mobile-pr', 'local-android', 'local-ios'])
const ToolPackNameSchema = z.enum([
  'skills',
  'agent-device',
  'repo-read',
  'repo-write',
  'react-devtools',
])
const PublisherNameSchema = z.enum(['file', 'blob'])
export const COMMAND_IDS = ['qa', 'review', 'perf-review', 'dev'] as const
const CommandIdSchema = z.enum(COMMAND_IDS)
const CaliPlatformSchema = z.enum(['android', 'ios'])

const StringArraySchema = z.union([z.string(), z.array(z.string())]).optional()

const MobileDefaultsSchema = z
  .object({
    platform: CaliPlatformSchema.optional(),
    deviceName: z.string().optional(),
    appId: z.string().optional(),
  })
  .optional()

const CommandConfigSchema = z.object({
  contextPath: z.string().optional(),
  enabledToolPacks: z.array(ToolPackNameSchema).optional(),
  outputPublishers: z.array(PublisherNameSchema).optional(),
  extraInstructions: StringArraySchema,
  model: z.string().optional(),
  mobileDefaults: MobileDefaultsSchema,
})

export function normalizeCaliEnvName(value?: string): CaliEnvName | undefined {
  const result = CaliEnvNameSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export const CaliConfigSchema = z.object({
  defaultCommand: CommandIdSchema.optional(),
  env: CaliEnvNameSchema.optional(),
  workspaceRoot: z.string().optional(),
  skillPaths: z.array(z.string()).optional(),
  outputPublishers: z.array(PublisherNameSchema).optional(),
  model: z.string().optional(),
  commands: z
    .object({
      qa: CommandConfigSchema.optional(),
      review: CommandConfigSchema.optional(),
      perfReview: CommandConfigSchema.optional(),
      dev: CommandConfigSchema.optional(),
    })
    .optional(),
})

export type CaliEnvName = z.infer<typeof CaliEnvNameSchema>
export type ToolPackName = z.infer<typeof ToolPackNameSchema>
export type PublisherName = z.infer<typeof PublisherNameSchema>
export type CommandId = z.infer<typeof CommandIdSchema>
export type CaliConfig = z.infer<typeof CaliConfigSchema>
export type CaliCommandConfig = z.infer<typeof CommandConfigSchema>
