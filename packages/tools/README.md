# @callstack/cali

Collection of tools for building AI agents that work with React Native. Exported tools can be used with [ai](https://www.npmjs.com/package/ai) package.

## Usage

```ts
// First, import all tools
import * as tools from "@cali/tools-react-native";

import { generateText } from "ai";
await generateText({
  prompt: {
    role: 'system',
    content: 'What is my React Native version?',
  },
  // Then, include them with the prompt
  tools,
});
```

## List of tools

### Android
- **getAdbPath** - Returns path to ADB executable
- **getAndroidDevices** - Gets available Android devices and emulators with ID, name, type, and boot status
- **bootAndroidEmulator** - Boots a given Android emulator and returns its ID
- **buildAndroidApp** - Builds Android application and install it on a given device
- **runAdbReverse** - Runs "adb reverse" to forward given port to a specified Android device
- **launchAndroidAppOnDevice** - Launches a given Android application on a specified device

### Apple
- **getAppleSimulators** - Gets available simulators for iOS, tvOS, or visionOS
- **installRubyGems** - Install Ruby gems, including CocoaPods
- **bootAppleSimulator** - Boots iOS simulator with specified device ID
- **buildAppleAppWithoutStarting** - Build application for Apple platforms without running it
- **buildStartAppleApp** - Build and start Apple application on simulator or device
- **installPods** - Install CocoaPods dependencies
- **startAppleLogging** - Start Apple gathering logs from simulator or device

### React Native
- **startMetroDevServer** - Starts Metro development server on a given port or a different available port
- **getReactNativeConfig** - Get React Native configuration including root directory, path, version, platforms, and project configuration
- **listReactNativeLibraries** - List React Native libraries from reactnative.directory

### NPM
- **installNpmPackage** - Install a package from npm by name
- **unInstallNpmPackage** - Uninstall a package from npm by name

### File System
- **getFileTree** - Get user file tree, can be used to determine the package.json location, package manager, etc.
- **readFile** - Read file, can be used to read package.json, etc.

### Git
- **applyDiff** - Apply a diff/patch to a file

## Learn more

Learn more about Cali on [GitHub](https://github.com/callstackincubator/cali).

## Missing a tool?

Please open an issue or a discussion to suggest a new tool. We are happy to hear from you! 👋

## Made with ❤️ at Callstack

Cali is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Callstack](https://callstack.com) is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥 
