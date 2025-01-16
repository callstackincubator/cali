#!/usr/bin/env node
import { log, spinner } from '@clack/prompts'
import { execute } from 'ai-flows'
import chalk from 'chalk'
import dedent from 'dedent'
import { retro } from 'gradient-string'

import { androidAgent, appleAgent, reactNativeAgent, userInputAgent } from './agents.js'
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

const s = spinner()

s.start('Thinking...')

const noisyFlows = ['startMetroServer', 'askUserToChooseFlow', 'askUserToChoosePlatform']

try {
  const response = await execute(mainFlow, {
    agents: {
      appleAgent,
      androidAgent,
      reactNativeAgent,
      userInputAgent,
    },
    onFlowStart(flow) {
      if (flow.name) {
        if (noisyFlows.includes(flow.name)) {
          s.stop(flow.name)
        } else {
          s.message(chalk.gray(flow.name))
        }
      }
    },
    onFlowFinish(flow) {
      if (flow.name && noisyFlows.includes(flow.name)) {
        s.start()
      }
    },
  })
  log.success(response)
} catch (error) {
  log.error(String(error))
} finally {
  s.stop()
}
