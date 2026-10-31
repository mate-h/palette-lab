import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [UnoCSS(), svelte()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
