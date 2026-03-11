import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true, // fail if 5174 is in use instead of switching to another port
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    globals: false,
  },
})
