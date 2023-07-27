import tsdoc from 'eslint-plugin-tsdoc';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default {
  ignores: ['dist/', 'node_modules/'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: { modules: true },
      ecmaVersion: 'latest',
      project: './tsconfig.json',
    },
  },

  plugins: { tsdoc, '@typescript-eslint': ts, tsParser },
  rules: {
    ...ts.configs['eslint-recommended'].rules,
    ...ts.configs.recommended.rules,
    'no-await-in-loop': 'error',
    'no-unreachable-loop': 'error',
    'no-use-before-define': 'error',
    'arrow-body-style': 'error',
    'class-methods-use-this': 'error',
    curly: 'error',
    'default-case': 'error',
    '@typescript-eslint/dot-notation': 'error',
    eqeqeq: 'error',
    'new-cap': 'error',
    'no-empty-function': 'error',
    'no-eval': 'error',
    'no-floating-decimal': 'error',
    'no-implicit-coercion': 'error',
    'no-implicit-globals': 'error',
    '@typescript-eslint/no-implied-eval': 'error',
    '@typescript-eslint/no-invalid-this': 'error',
    'no-lonely-if': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-shadow': 'error',
    'no-shadow-restricted-names': 'error',
    'no-unneeded-ternary': 'error',
    'no-useless-return': 'error',
    'prefer-const': 'warn',
    'prefer-promise-reject-errors': 'error',
    'spaced-comment': 'error',
    yoda: 'error',
    // ts
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-use-before-define': 'error',
    '@typescript-eslint/consistent-indexed-object-style': 'error',
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/consistent-type-definitions': 'error',
    // style
    'array-bracket-spacing': ['warn', 'never'],
    'array-bracket-newline': ['warn', 'consistent'],
    'arrow-parens': ['warn', 'as-needed'],
    'arrow-spacing': 'warn',
    'brace-style': ['warn', '1tbs'],
    '@typescript-eslint/comma-dangle': ['warn', 'always-multiline'],
    '@typescript-eslint/comma-spacing': 'warn',
    'comma-style': 'warn',
    'eol-last': ['warn', 'always'],
    '@typescript-eslint/indent': ['warn', 2, { SwitchCase: 1 }],
    '@typescript-eslint/key-spacing': 'warn',
    '@typescript-eslint/keyword-spacing': 'warn',
    'linebreak-style': ['warn', 'unix'],
    'multiline-ternary': ['warn', 'always-multiline'],
    'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
    'no-trailing-spaces': 'warn',
    'new-parens': 'warn',
    '@typescript-eslint/quotes': ['warn', 'single', { avoidEscape: true }],
    '@typescript-eslint/semi': ['warn', 'always'],
    'space-before-function-paren': ['warn', 'never'],
    'semi-style': ['warn', 'last'],
    // tsdoc
    'tsdoc/syntax': 'warn',
  },
};
