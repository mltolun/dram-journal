import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Replace 'dram-journal' with your actual GitHub repo name
  base: process.env.NODE_ENV === 'production' ? '/dram-journal' : '/',
})
