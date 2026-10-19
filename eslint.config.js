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
      // React Compiler advisories (eslint-plugin-react-hooks 7.1): a ref read during render, Date.now in
      // render, setState inside an effect. Six places in App.jsx, Play.jsx, RoadmapUpNext.jsx and
      // WhatsNewUpNext.jsx do these on purpose; warnings until each is reworked (ROADMAP area 25)
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
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
    // Vercel serverless functions and their tests run on Node
    files: ['api/**/*.js', 'middleware.js', 'src/**/*.test.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
])
