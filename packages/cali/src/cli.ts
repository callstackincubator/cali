#!/usr/bin/env node

import { log } from '@clack/prompts'
import { execute } from 'ai-flows'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'

import {
  androidAgent,
  appleAgent,
  processAgent,
  reactNativeAgent,
  userInputAgent,
} from './agents.js'
import { mainFlow } from './flows.js'

import 'dotenv/config'

console.clear()

process.on('uncaughtException', (error) => {
  console.error(chalk.red(error.message))
  console.log(chalk.gray(error.stack))
})

console.log(
  retro(`
  ██████╗ █████╗ ██╗     ██╗
 ██╔════╝██╔══██╗██║     ██║
 ██║     ███████║██║     ██║
 ██║     ██╔══██║██║     ██║
 ╚██████╗██║  ██║███████╗██║
  ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝
`)
)

console.log(
  chalk.gray(dedent`
    AI agent for building React Native apps.
    
    Powered by: ${chalk.bold('Vercel AI SDK')} & ${chalk.bold('React Native CLI')}
  `)
)

console.log()

try {
  const response = await execute(mainFlow, {
    agents: {
      appleAgent,
      androidAgent,
      reactNativeAgent,
      userInputAgent,
      processAgent,
    },
    onFlowStart(flow) {
      if (flow.name) {
        log.info(chalk.gray(flow.name))
      }
    },
    onFlowFinish(flow) {
      if (flow.name) {
        log.success(chalk.gray(flow.name))
      }
    },
  })
  log.success(response)
} catch (error) {
  log.error(String(error))
}
