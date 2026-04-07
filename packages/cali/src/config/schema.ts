import { z } from 'zod'

const QaEnvNameSchema = z.enum(['mobile-pr', 'local-android', 'local-ios'])
const ToolPackNameSchema = z.enum(['skills', 'agent-device'])
const PublisherNameSchema = z.enum(['file', 'blob'])
const QaPlatformSchema = z.enum(['android', 'ios'])

const StringArraySchema = z.union([z.string(), z.array(z.string())]).optional()

export function normalizeQaEnvName(value?: string): QaEnvName | undefined {
  switch (value) {
    case 'mobile-pr':
    case 'local-android':
    case 'local-ios':
      return value
    default:
      return undefined
  }
}

export const CaliQaConfigSchema = z.object({
  role: z.literal('qa').optional(),
  env: QaEnvNameSchema.optional(),
  appId: z.string().optional(),
  contextPath: z.string().optional(),
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

export type QaEnvName = z.infer<typeof QaEnvNameSchema>
export type ToolPackName = z.infer<typeof ToolPackNameSchema>
export type PublisherName = z.infer<typeof PublisherNameSchema>
export type CaliQaConfig = z.infer<typeof CaliQaConfigSchema>
