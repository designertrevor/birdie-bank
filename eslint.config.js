import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // New in eslint 10's recommended set. It flags a starting value that every path then replaces
      // (let x = 0; try { x = ... } catch { x = 0 }), which this code does on purpose in 11 places so
      // the fallback is in plain sight. Off, since none of them is a bug
      'no-useless-assignment': 'off',
      // The art galleries export the list of their drawings beside the components (made with
      // Object.keys, so not a constant the vite preset already allows)
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true, allowCompoundComponents: true, allowExportNames: ['GAME_ART_KINDS', 'SCENE_KINDS'],
      }],
    },
  },
  {
    // The entry point renders the app and exports nothing, by design
    files: ['src/main.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Vercel serverless functions, their tests and the end to end test run on Node
    files: ['api/**/*.js', 'middleware.js', 'src/**/*.test.js', 'e2e/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
])
