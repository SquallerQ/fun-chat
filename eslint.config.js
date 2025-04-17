import eslint from "@eslint/js";
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettier from 'eslint-plugin-prettier'; 

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      sourceType: 'module',
      globals: {
        Node: 'readonly',
      },
    },
    plugins: {
      unicornPlugin,
      '@typescript-eslint': typescriptEslint,
      prettier,
    },
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-null': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': ['error'],
      'prettier/prettier': ['error'],
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
];
