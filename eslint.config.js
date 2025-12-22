import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import astro from 'eslint-plugin-astro';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  eslint.configs.recommended,
  ...astro.configs.recommended,
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: {
        parser: tsparser,
      },
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    ignores: ['dist/', 'build/', 'coverage/', 'node_modules/', '.astro/', '*.min.js'],
  },
];
