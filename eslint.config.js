import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

export default tseslint.config(
  // Global ignores
  { ignores: ['dist', '.next', 'node_modules', 'android', 'ios', '*.config.js', '*.config.cjs', '*.config.ts'] },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript recommended rules (strict)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript parser options
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React configuration
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React rules
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // React Refresh (Vite HMR)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Strict rules for catching bugs
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }, // Allow async onClick handlers
      ],

      // Relaxed rules (too noisy or stylistic)
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // || vs ?? is often intentional
      '@typescript-eslint/require-await': 'off', // async without await is often intentional
      '@typescript-eslint/no-unnecessary-condition': 'off', // Defensive coding is fine
      '@typescript-eslint/restrict-template-expressions': 'off', // Numbers in templates is fine
      '@typescript-eslint/no-empty-function': 'off', // Needed for stubs/mocks
      '@typescript-eslint/no-confusing-void-expression': 'off', // Stylistic
      '@typescript-eslint/strict-boolean-expressions': 'off',

      // General best practices
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },

  // Test file overrides
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Prettier (must be last to override formatting rules)
  prettier
)
