import { defineConfig } from '@rslib/core'

export default defineConfig({
  lib: [
    {
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
      format: 'esm',
      output: {
        distPath: {
          root: 'dist',
        },
      },
    },
  ],
})
