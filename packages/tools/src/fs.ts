import { mkdir, readdir, readFile as readFileNode, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { tool } from 'ai'
import { z } from 'zod'

const fileEncodingSchema = z
  .enum([
    'ascii',
    'utf8',
    'utf-8',
    'utf16le',
    'utf-16le',
    'ucs2',
    'ucs-2',
    'base64',
    'base64url',
    'latin1',
    'binary',
    'hex',
  ])
  .default('utf-8')

const readFileInputSchema = z.object({
  path: z.string(),
  is_image: z.boolean(),
  encoding: fileEncodingSchema,
})

type ReadFileInput = z.infer<typeof readFileInputSchema>
type ReadFileResult = string | { data: string; mimeType: string }

export const listFiles = tool({
  description:
    'List all files in a directory. If path is nested, you must call it separately for each segment',
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => {
    return readdir(path)
  },
})

export const currentDirectory = tool({
  description: 'Get the current working directory',
  inputSchema: z.object({}),
  execute: async () => {
    return process.cwd()
  },
})

export const makeDirectory = tool({
  description: 'Create a new directory',
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => {
    return mkdir(path)
  },
})

export const readFile = tool({
  description: 'Reads a file at a given path',
  inputSchema: readFileInputSchema,
  execute: async ({ path, is_image, encoding }: ReadFileInput): Promise<ReadFileResult> => {
    const file = await readFileNode(path, { encoding })
    if (is_image) {
      return {
        data: file,
        mimeType: `image/${extname(path).toLowerCase().replace('.', '')}`,
      }
    } else {
      return file
    }
  },
  toModelOutput({ output }: { output: ReadFileResult }) {
    return typeof output === 'string'
      ? { type: 'text', value: output }
      : {
          type: 'content',
          value: [{ type: 'file-data', data: output.data, mediaType: output.mimeType }],
        }
  },
})

export const saveFile = tool({
  description: 'Save a file at a given path',
  inputSchema: z.object({
    path: z.string(),
    content: z.string(),
    encoding: fileEncodingSchema,
  }),
  execute: async ({ path, content, encoding }) => {
    return writeFile(path, content, { encoding })
  },
})
