#!/usr/bin/env node

import 'dotenv/config'

import { spinner } from '@clack/prompts'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'
import { execute } from 'workflows-ai'

import { androidAgent, appleAgent, reactNativeAgent, userInputAgent } from './agents.js'
import { mainFlow } from './flows.js'

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

const s = spinner()

const response = await execute(mainFlow, {
  agents: {
    appleAgent,
    androidAgent,
    reactNativeAgent,
    userInputAgent,
  },
  onFlowStart(flow) {
    s.message(chalk.gray(`Executing: ${flow.name}`))
  },
})

s.stop()

console.log(response)
