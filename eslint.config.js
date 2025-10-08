import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import security from 'eslint-plugin-security'
import importPlugin from 'eslint-plugin-import'
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

  // Security plugin recommended rules (applied globally)
  security.configs.recommended,

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
    ignores: [
      '*.config.{js,ts,mjs}',
      '*.config.*.{js,ts,mjs}',
      'vite.config.ts',
    ],
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
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json', './tsconfig.node.json'],
        },
        node: true,
      },
    },
    plugins: {
      react: react,
      import: importPlugin,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,

      // ==========================================
      // React Rules
      // ==========================================
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'react/jsx-no-target-blank': ['error', { enforceDynamicLinks: 'always' }],
      'react/no-danger': 'warn',
      'react/no-danger-with-children': 'error',

      // ==========================================
      // TypeScript Rules (Enhanced)
      // ==========================================
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
          classes: true,
          variables: true,
        },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowNumber: true,
          allowBoolean: true,
        },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',

      // ==========================================
      // Import/Export Rules
      // ==========================================
      'import/no-unresolved': 'off', // TypeScript handles this
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/no-absolute-path': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-useless-path-segments': 'error',
      'import/no-deprecated': 'warn',
      'import/no-mutable-exports': 'error',
      'import/first': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // ==========================================
      // General Security & Best Practices
      // ==========================================
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-proto': 'error',
      'no-iterator': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'event', message: 'Use local parameter instead.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'localStorage',
          message: 'Use secure storage mechanisms in Electron apps.',
        },
        {
          object: 'window',
          property: 'sessionStorage',
          message: 'Use secure storage mechanisms in Electron apps.',
        },
      ],

      // Production-ready error handling
      'no-console': 'error', // Will be overridden per environment below
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },

  // Renderer (browser) code - Frontend React App
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
      'react-hooks/exhaustive-deps': 'error', // Upgraded from warn
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Console rules for renderer - strict for production
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Renderer-specific security
      'no-restricted-globals': [
        'error',
        {
          name: 'require',
          message: 'Use import instead of require in renderer process.',
        },
        {
          name: 'process',
          message:
            'Avoid accessing Node.js process in renderer. Use IPC instead.',
        },
      ],
    },
  },

  // Electron main/preload (Node) code - Enhanced Security
  {
    files: ['electron/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2020 },
    },
    rules: {
      'react-refresh/only-export-components': 'off',

      // Logging is acceptable in main process but discourage console.log
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],

      // ==========================================
      // Electron Security Rules
      // ==========================================
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.name='webPreferences'][property.name='nodeIntegration'][parent.Property.value.value=true]",
          message: 'nodeIntegration should be false for security.',
        },
        {
          selector:
            "MemberExpression[object.name='webPreferences'][property.name='contextIsolation'][parent.Property.value.value=false]",
          message: 'contextIsolation should be true for security.',
        },
      ],

      'no-restricted-properties': [
        'error',
        {
          object: 'electron',
          property: 'remote',
          message:
            'The remote module is deprecated and insecure. Use IPC instead.',
        },
        {
          property: 'enableRemoteModule',
          message: 'Remote module is deprecated and insecure. Use IPC instead.',
        },
      ],

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron/remote', '@electron/remote'],
              message:
                'Remote module is deprecated and insecure. Use IPC instead.',
            },
          ],
        },
      ],

      // Require proper error handling in main process
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // IPC security
      'security/detect-object-injection': 'warn', // Can have false positives
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-child-process': 'warn',
    },
  },

  // Preload scripts - Extra strict security
  {
    files: ['electron/preload.ts', 'electron/**/preload*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'eval',
          message: 'eval is forbidden in preload scripts.',
        },
      ],
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-require': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
    },
  },

  // Disable rules that might conflict with Prettier formatting
  eslintConfigPrettier
)
