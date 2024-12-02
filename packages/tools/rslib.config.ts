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
        externals: [/react-native-community/],
        distPath: {
          root: 'dist',
        },
      },
    },
    {
      source: {
        entry: {
          index: './src/index.ts',
        },
      },
      format: 'cjs',
      output: {
        externals: [/react-native-community/],
        distPath: {
          root: 'dist',
        },
      },
    },
  ],
})
