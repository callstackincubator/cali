import { z } from 'zod'

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
export const CaliPlatformSchema = z.enum(['android', 'ios'])

const StringArraySchema = z.union([z.string(), z.array(z.string())]).optional()

const MobileDefaultsSchema = z
  .object({
    platform: CaliPlatformSchema.optional(),
    deviceName: z.string().optional(),
    appId: z.string().optional(),
  })
  .strict()
  .optional()

const CommandConfigSchema = z
  .object({
    contextPath: z.string().optional(),
    enabledToolPacks: z.array(ToolPackNameSchema).optional(),
    outputPublishers: z.array(PublisherNameSchema).optional(),
    extraInstructions: StringArraySchema,
    model: z.string().optional(),
    mobileDefaults: MobileDefaultsSchema,
  })
  .strict()

export const CaliConfigSchema = z
  .object({
    defaultCommand: CommandIdSchema.optional(),
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
      .strict()
      .optional(),
  })
  .strict()

export type ToolPackName = z.infer<typeof ToolPackNameSchema>
export type PublisherName = z.infer<typeof PublisherNameSchema>
export type CommandId = z.infer<typeof CommandIdSchema>
export type CaliConfig = z.infer<typeof CaliConfigSchema>
export type CaliCommandConfig = z.infer<typeof CommandConfigSchema>
export type CaliPlatform = z.infer<typeof CaliPlatformSchema>
