#!/usr/bin/env node

import * as tools from '@cali/tools-react-native'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import zodToJsonSchema from 'zod-to-json-schema'

const server = new Server(
  {
    name: '@cali/mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(tools).map(([name, tool]) => ({
      name,
      description: 'description' in tool ? tool.description : '',
      inputSchema: zodToJsonSchema(tool.parameters),
    })),
  }
})

/**
 * Handler for calling tools
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools[request.params.name as keyof typeof tools]

  if (!tool) {
    throw new Error(`Tool ${request.params.name} not found`)
  }

  try {
    const args = tool.parameters.parse(request.params.arguments)

    // @ts-ignore
    const result = await tool.execute(args, {
      messages: [],
    })

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (error) {
    throw new Error(
      `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
})

/**
 * Start the server using stdio transport
 */
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
