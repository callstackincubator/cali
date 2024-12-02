import { defineConfig } from '@rslib/core'

import { dependencies } from './package.json'

/**
 * We need to bundle `ai` dependency with the CLI, because we have custom patch for it.
 * We delete `ai` from dependencies that are passed as `externals`.
 */
// @ts-ignore
delete dependencies.ai

export default defineConfig({
  lib: [
    {
      source: {
        entry: {
          index: './src/cli.ts',
        },
      },
      format: 'esm',
      bundle: true,
      autoExternal: {
        dependencies: false,
      },
      output: {
        externals: Object.keys(dependencies),
        distPath: {
          root: 'dist',
        },
      },
    },
  ],
})
