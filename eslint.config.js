import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
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

  // Configuration files first (before type-checked rules)
  {
    files: ['*.config.{js,ts,mjs}', '*.config.*.{js,ts,mjs}', 'vite.config.ts'],
    ...tseslint.configs.base,
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },

  // Apply type-checked rules only to TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['*.config.{js,ts,mjs}', '*.config.*.{js,ts,mjs}', 'vite.config.ts'],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    plugins: {
      'react': react,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // Turn off rules that require prop-types (we use TypeScript)
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      // TypeScript specific rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-use-before-define': ['error', { 
        functions: false,
        classes: true,
        variables: true,
      }],
      // Relax some overly strict rules
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: {
          attributes: false,
        },
      }],
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
      // Allow console.log in development
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Electron main/preload (Node) code
  {
    files: ['electron/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2020 },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
      // Node.js often uses console for logging
      'no-console': 'off',
    },
  },

  // Disable rules that might conflict with Prettier formatting
  eslintConfigPrettier
)