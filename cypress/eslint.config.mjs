import stylistic from '@stylistic/eslint-plugin';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
    {
        ignores: ['node_modules/**'],
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 2021,
                sourceType: 'module',
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            '@stylistic': stylistic,
            react: eslintPluginReact,
            'react-hooks': eslintPluginReactHooks,
        },
        rules: {
            eqeqeq: ['error', 'smart'],
            '@stylistic/indent': 'error',
            '@stylistic/quotes': ['error', 'single'],
            '@stylistic/arrow-parens': 'error',
            '@stylistic/arrow-spacing': 'error',
            '@stylistic/brace-style': 'error',
            '@stylistic/computed-property-spacing': ['error', 'never'],
            '@stylistic/jsx-quotes': ['error', 'prefer-single'],
            '@stylistic/keyword-spacing': ['error', { before: true }],
            '@stylistic/semi': 'error',
            '@stylistic/space-before-function-paren': 'error',
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/space-unary-ops': 'error',
            '@typescript-eslint/no-unused-vars': 'error',
            '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
            'react/prop-types': 'off',
        },
        settings: {
            react: { version: 'detect' },
        },
    }
);
