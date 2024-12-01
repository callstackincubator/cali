import { defineConfig } from '@rslib/core'

import { dependencies } from './package.json'

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
