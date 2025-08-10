import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  // Ignore build output, static assets, and legacy config files
  {
    ignores: [
      'dist',
      'dist-electron',
      'public',
      'node_modules',
      '**/.eslintrc.*',
    ],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (no type-checking)
  ...tseslint.configs.recommended,

  // Global language options
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
  },

  // Renderer (browser) code
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2020 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // Electron main/preload (Node) code
  {
    files: ['electron/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2020 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Disable rules that might conflict with Prettier formatting
  eslintConfigPrettier
)
