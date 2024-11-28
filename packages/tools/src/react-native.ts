import { tool } from 'ai'
import dedent from 'dedent'
import { z } from 'zod'

import {
  findDevServerPort,
  getDefaultUserTerminal,
  loadReactNativeConfig,
  startServerInNewWindow,
} from './vendor/react-native-cli.js'

export const startMetroDevServer = tool({
  description: dedent`
    Starts Metro development server on a given port or a different available port.
    Returns port Metro server started on.
  `,
  parameters: z.object({
    port: z.number().default(8081),
    reactNativeConfig_root: z.string(),
    reactNativeConfig_reactNativePath: z.string(),
  }),
  execute: async ({
    port,
    reactNativeConfig_root: root,
    reactNativeConfig_reactNativePath: reactNativePath,
  }) => {
    try {
      const { port: newPort } = await findDevServerPort(port, root)
      startServerInNewWindow(newPort, root, reactNativePath, getDefaultUserTerminal())
      return {
        success: `Metro server started on port ${newPort}.`,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to start Metro bundler',
      }
    }
  },
})

export const getReactNativeConfig = tool({
  description: dedent`
    Get React Native configuration. 
    
    Returns:
      - "root" - root directory of the project
      - "path" - path to React Native CLI installation
      - "platforms" - available platforms
      - "project" - project configuration per platform

    Apple project configuration:
      - "sourceDir" - iOS source directory
      - "xcodeProject" - Xcode project configuration
        - "name" - iOS project name
        - "path" - path to the Xcode project
        - "isWorkspace" - whether the project is a workspace
      - "assets" - iOS assets

    Android project configuration:
      - "sourceDir" - Android source directory
      - "appName" - Android app name
      - "packageName" - Android package name
      - "applicationId" - Android application ID
      - "mainActivity" - Android main activity
      - "assets" - Android assets
  `,
  parameters: z.object({}),
  execute: async () => {
    try {
      const { root, reactNativePath: path, project, platforms } = await loadReactNativeConfig()
      return {
        root,
        path,
        project,
        platforms,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to get React Native config',
      }
    }
  },
})

export const listReactNativeLibraries = tool({
  description: dedent`
    List React Native libraries from reactnative.directory.
    Can be used to search for libraries by name or category.

    Returns:
      - "name" - library name with stars count, show only this in the list.
      - "description" - library description
      - "npmPackageName" - npm package name to use with "npm install"
      - "score" - library score
      - "url" - library GitHub repository URL
  `,
  parameters: z.object({
    search: z.string().optional(),
  }),
  execute: async ({ search }) => {
    try {
      const response = await fetch(
        `https://reactnative.directory/api/libraries${search ? `?search=${search}` : ''}`
      )
      const { libraries } = await response.json()

      const mappedLibraries = libraries.map((library: any) => ({
        name: `${library.github.name} (★ ${library.github.stats.stars})`,
        description: library.description,
        npmPackageName: library.npmPkg,
        score: library.score,
        url: library.github.urls.repo,
      }))

      return {
        success: true,
        action: dedent`
          Ask user to pick a library from the list.
          Offer user an option to try different search query.
          Offer user an option to cancel the operation and proceed with something else.

          For each library, you can use "installNpmPackage" tool to install it.
          You can also offer to display package description or visit Github repository.
        `,
        libraries: mappedLibraries,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to start Metro bundler',
      }
    }
  },
})

export const getReactNativeReleases = tool({
  description: dedent`
    Gets releases of React Native from GitHub.

    When upgrading React Native, ask user to select a version from the list.

    RnDiffApp is the name of the app that generates diffs between two versions of React Native.

    Make sure to replace RnDiffApp with the actual name of the app in the response.
  `,
  parameters: z.object({}),
  execute: async () => {
    try {
      const response = await fetch(`https://api.github.com/repos/facebook/react-native/releases`)
      const list = await response.json()

      const mappedList = list
        .filter((release: any) => !release.prerelease)
        .map((release: any) => ({
          name: release.name,
          tag: release.tag_name,
        }))

      return {
        success: true,
        action: dedent`
          Ask user to select a version from the list.
        `,
        releases: mappedList,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to retrieve versions',
      }
    }
  },
})

export const upgradeReactNativeDiff = tool({
  description: dedent`
    Upgrade React Native diff tool, returns a diff between two versions of React Native.

    Parameters:
      - "from" - source version, (Read the exact version from package.json using "readFile" tool). Example: "0.75.0"
      - "to" - target version (latest React Native version). Example: "0.76.3"

    Returns: 
      - "diff" - diff between two versions, containing differences in the project files you need to apply. Make sure to apply it 2 levels deep in the project tree.
                 When applying the diff, make sure to ask user for confirmation before proceeding. Don't read the files before applying the diff just apply it.
  `,
  parameters: z.object({
    from: z.string(),
    to: z.string(),
  }),
  execute: async ({ from, to }) => {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/react-native-community/rn-diff-purge/diffs/diffs/${from}..${to}.diff`
      )
      const diff = await response.text()

      return {
        success: true,
        action: dedent`
          Go over user file tree and apply diffs to the project.
        `,
        diff,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to retrieve diff',
      }
    }
  },
})
