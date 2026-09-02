import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('eslint').Linter.FlatConfig[]} */
const nextConfig = require('eslint-config-next/core-web-vitals');

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      'legacy/**',
      '.next/**',
      'node_modules/**',
      'src/views/**',
      'src/services/*.js',
      'src/utils/**',
      'src/dto/**',
      'src/components/ui/*.jsx',
      'src/config/pages.js',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': nextConfig.find((c) => c.plugins?.['@typescript-eslint'])?.plugins[
        '@typescript-eslint'
      ],
    },
    settings: {
      react: { version: '19' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];

export default eslintConfig;
