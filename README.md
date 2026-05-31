<div align="center">
  <h1>cali</h1>
</div>

<p align="center">
  <img src="https://github.com/user-attachments/assets/3554c7d3-0ea8-40a2-bd9c-176cfec231af" width="500" />
</p>

<p align="center">
  🪄 An AI agent for building React Native apps 
</p>

---

```bash
$ npx cali
```

## Wait, what?

Cali is an AI agent that helps you build React Native apps. It takes all the utilities and functions of a React Native CLI and exposes them as tools to an LLM.

Thanks to that, an LLM can help you with your React Native app development, without the need to remember commands, spending time troubleshooting errors, and in the future, much more.

## How can I use it?

You can use Cali in three ways:

- **standalone** - [`cali`](./packages/cali/README.md) - AI agent that runs in your terminal. Ready to use out of the box.
- **with Vercel AI SDK** - [`cali-tools`](./packages/tools/README.md) - Collection of tools for building React Native apps with [Vercel AI SDK](https://github.com/ai-sdk/ai)
- **with Claude, Zed, and other MCP Clients** - [`cali-mcp-server`](./packages/mcp-server/README.md) - [MCP server](http://modelcontextprotocol.io) for using Cali with Claude and other compatible environments

## What can it do?

Cali is still in the early stages of development, but it already supports:

- **Build Automation**: Running and building React Native apps on iOS and Android
- **Device Management**: Listing and managing connected Android and iOS devices and simulators
- **Dependency Management**: Install and manage npm packages and CocoaPods dependencies.
- **React Native Library Search**: Searching and listing React Native libraries from [React Native Directory](https://reactnative.directory)

You can learn more about available tools [here](./packages/tools/README.md).

## Examples

#### Building an app step-by-step

<video src="https://github.com/user-attachments/assets/1d9c3f5b-d5cd-4901-8cad-bd10f1a45b07" width="500"></video>

#### Building an app with a highly-specific task

<video src="https://github.com/user-attachments/assets/74638f88-3515-4531-831c-7a98c2d4acd2" width="500"></video>

#### Searching and installing a new React Native library

[TBD]

#### Troubleshooting an error

[TBD]

## Future requests

I like the idea of an AI agent for building React Native apps. I would like to play around with this idea in public, and see where it goes.

Feel free to open an issue or a discussion to suggest ideas or report bugs. Happy to hear from you! 👋

## Made with ❤️ at Callstack

Cali is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Callstack](https://callstack.com) is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥 


---

## FAQ

### What is Cali?

Cali is an AI agent that helps you build React Native apps. It takes all the utilities and functions of a React Native CLI and exposes them as tools to an LLM, enabling AI-powered React Native development.

### How can I use Cali?

| Mode | Package | Description |
|------|---------|-------------|
| **Standalone** | `cali` | AI agent that runs in your terminal, ready to use out of the box |
| **Vercel AI SDK** | `cali-tools` | Collection of tools for building React Native apps with Vercel AI SDK |
| **MCP Clients** | `cali-mcp-server` | MCP server for using Cali with Claude, Zed, and other MCP-compatible environments |

### What can Cali do?

| Capability | Description |
|------------|-------------|
| **Build Automation** | Running and building React Native apps on iOS and Android |
| **Device Management** | Listing and managing connected Android and iOS devices and simulators |
| **Dependency Management** | Install and manage npm packages and CocoaPods dependencies |
| **Library Search** | Searching React Native libraries from [React Native Directory](https://reactnative.directory) |

### How do I install Cali?

```bash
npx cali
```

### What are the available tools?

Learn more about available tools in the [tools README](./packages/tools/README.md).

### What packages are available?

| Package | README |
|---------|--------|
| **cali** | [packages/cali/README.md](./packages/cali/README.md) |
| **cali-tools** | [packages/tools/README.md](./packages/tools/README.md) |
| **cali-mcp-server** | [packages/mcp-server/README.md](./packages/mcp-server/README.md) |

### Is Cali free?

Yes, Cali is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

### Who maintains Cali?

Cali is made with ❤️ at [Callstack](https://callstack.com), a group of React and React Native geeks.

### How can I contribute?

Feel free to open an issue or a discussion to suggest ideas or report bugs. Happy to hear from you! 👋

### Where can I get help?

- **GitHub Issues**: [callstackincubator/cali/issues](https://github.com/callstackincubator/cali/issues)
- **Callstack**: [hello@callstack.com](mailto:hello@callstack.com)
- **Careers**: [callstack.com/careers](https://callstack.com/careers)

### What license does Cali use?

Cali is open source. Check the [LICENSE](LICENSE) file for details.

