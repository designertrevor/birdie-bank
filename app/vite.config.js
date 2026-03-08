import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
