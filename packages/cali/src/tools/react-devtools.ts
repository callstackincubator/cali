import type { ToolTraceEntry } from '../runtime/types.js'
import { createCliTool } from './cli-tool.js'

type CreateReactDevtoolsToolPackOptions = {
  trace: ToolTraceEntry[]
}

export function createReactDevtoolsToolPack(options: CreateReactDevtoolsToolPackOptions) {
  const { trace } = options

  return createCliTool({
    toolName: 'react_devtools',
    binaryName: 'agent-react-devtools',
    description:
      'Run an agent-react-devtools command to inspect the component tree, props, state, hooks, or profile runtime performance.',
    trace,
  })
}
