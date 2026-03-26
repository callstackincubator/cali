#!/usr/bin/env node

import 'dotenv/config'

import { runCli } from './cli/app.js'

async function main() {
  await runCli()
}

main().catch((error) => {
  const message = error instanceof Error ? error : new Error(String(error))
  console.error(message.message)
  if (message.stack) {
    console.error(message.stack)
  }
  process.exitCode = 1
})
