import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      VITE_DEMO: 'true',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: ''
    },
    include: ['tests/**/*.test.js']
  }
})
