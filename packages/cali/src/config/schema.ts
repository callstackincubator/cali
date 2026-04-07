import { z } from 'zod'

export const QaPresetNameSchema = z.enum([
  'eas-mobile-pr',
  'github-actions-pr',
  'local-android',
  'local-ios',
])
export const EnvironmentAdapterNameSchema = z.enum([
  'eas-env',
  'github-actions-env',
  'local-flags',
  'json-file',
])
export const ToolPackNameSchema = z.enum(['skills', 'agent-device'])
export const PublisherNameSchema = z.enum(['file', 'blob'])
const QaPlatformSchema = z.enum(['android', 'ios'])

const StringArraySchema = z.union([z.string(), z.array(z.string())]).optional()

export const CaliQaConfigSchema = z.object({
  role: z.literal('qa').optional(),
  preset: QaPresetNameSchema.optional(),
  environmentAdapter: EnvironmentAdapterNameSchema.optional(),
  appId: z.string().optional(),
  platformDefaults: z
    .object({
      platform: QaPlatformSchema.optional(),
      deviceName: z.string().optional(),
    })
    .optional(),
  outputDir: z.string().optional(),
  skillPaths: z.array(z.string()).optional(),
  enabledToolPacks: z.array(ToolPackNameSchema).optional(),
  outputPublishers: z.array(PublisherNameSchema).optional(),
  extraInstructions: StringArraySchema,
  model: z.string().optional(),
})

export type QaPresetName = z.infer<typeof QaPresetNameSchema>
export type EnvironmentAdapterName = z.infer<typeof EnvironmentAdapterNameSchema>
export type ToolPackName = z.infer<typeof ToolPackNameSchema>
export type PublisherName = z.infer<typeof PublisherNameSchema>
export type CaliQaConfig = z.infer<typeof CaliQaConfigSchema>
