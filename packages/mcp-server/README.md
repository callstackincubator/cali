# cali-mcp-server

> [!NOTE]
> This package is not yet released. It is a work in progress.

Model Context Protocol server that allows you to build and work with React Native apps. Under the hood it uses [@cali/tools](./tools/README.md).

## Installation

```
{
  "mcpServers": {
    "react-native": {
      "command": "npx run cali-mcp-server@latest",
      "env": {
        "FILESYSTEM_ROOT": "/path/to/your/react-native-project"
      }
    }
  }
}
```

## Debugging

```
bun run inspector
```

Then, from the inspector UI, set command to `bun` and arguments to `/Absolute/Path/To/mcp-server/src/index.ts`
