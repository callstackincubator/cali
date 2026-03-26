#!/usr/bin/env node

import { runQaCommand } from './commands/qa.js'
import type { QaCliOptions } from './env/types.js'
import { normalizePlatform } from './utils.js'

function printHelp() {
  console.log(`cali v2

Usage:
  cali qa [options]

Options:
  --preset <name>       Built-in preset: eas-mobile-pr, local-android, local-ios
  --config <path>       Path to cali.config.ts
  --prompt <text>       Add task-specific QA intent
  --json <path>         Load normalized environment context from JSON
  --platform <name>     android or ios
  --artifact <path>     App artifact path (.apk, .aab, .app, .ipa)
  --app-id <id>         Application identifier / package name
  --device <name>       Simulator or emulator name to provision
  --output-dir <path>   Output directory for artifacts
  --build-id <id>       Build identifier
  --workflow-url <url>  Workflow or build link
  --pr-number <n>       Pull request number
  --pr-title <text>     Pull request title
  --pr-body <text>      Pull request body
  --task-id <id>        Task identifier
  --task-title <text>   Task title
  --task-body <text>    Task body
  --model <id>          Override the QA model
  --help                Show this help
`)
}

function readFlagValue(argv: string[], index: number) {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${argv[index]}`)
  }

  return value
}

function parseQaArgs(argv: string[]): QaCliOptions {
  const options: QaCliOptions = {}

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    switch (argument) {
      case '--preset':
        options.presetName = readFlagValue(argv, index) as QaCliOptions['presetName']
        index += 1
        break
      case '--config':
        options.configPath = readFlagValue(argv, index)
        index += 1
        break
      case '--prompt':
        options.prompt = readFlagValue(argv, index)
        index += 1
        break
      case '--json':
        options.jsonPath = readFlagValue(argv, index)
        index += 1
        break
      case '--platform': {
        const platform = normalizePlatform(readFlagValue(argv, index))
        if (!platform) {
          throw new Error('`--platform` must be `android` or `ios`.')
        }
        options.platform = platform
        index += 1
        break
      }
      case '--artifact':
        options.artifactPath = readFlagValue(argv, index)
        index += 1
        break
      case '--app-id':
        options.appId = readFlagValue(argv, index)
        index += 1
        break
      case '--device':
        options.deviceName = readFlagValue(argv, index)
        index += 1
        break
      case '--output-dir':
        options.outputDir = readFlagValue(argv, index)
        index += 1
        break
      case '--build-id':
        options.buildId = readFlagValue(argv, index)
        index += 1
        break
      case '--workflow-url':
        options.workflowUrl = readFlagValue(argv, index)
        index += 1
        break
      case '--pr-number':
        options.prNumber = Number(readFlagValue(argv, index))
        index += 1
        break
      case '--pr-title':
        options.prTitle = readFlagValue(argv, index)
        index += 1
        break
      case '--pr-body':
        options.prBody = readFlagValue(argv, index)
        index += 1
        break
      case '--task-id':
        options.taskId = readFlagValue(argv, index)
        index += 1
        break
      case '--task-title':
        options.taskTitle = readFlagValue(argv, index)
        index += 1
        break
      case '--task-body':
        options.taskBody = readFlagValue(argv, index)
        index += 1
        break
      case '--model':
        options.model = readFlagValue(argv, index)
        index += 1
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  return options
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command !== 'qa') {
    throw new Error(`Unsupported command: ${command}`)
  }

  await runQaCommand(parseQaArgs(rest))
}

main().catch((error) => {
  const message = error instanceof Error ? error : new Error(String(error))
  console.error(message.message)
  if (message.stack) {
    console.error(message.stack)
  }
  process.exitCode = 1
})
