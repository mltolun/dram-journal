import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import scrapeWhiskyPlugin from './vite-plugin-scrape-whisky.js'

export default defineConfig({
  plugins: [
    vue(),
    scrapeWhiskyPlugin(),
  ],
  base: process.env.VITE_BASE_PATH || '/',
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
  },
})