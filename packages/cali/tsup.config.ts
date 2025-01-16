import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./src/**/*.ts'],
  format: ['esm'],
  target: 'node22',
  splitting: false,
  clean: true,
  dts: true,
})
