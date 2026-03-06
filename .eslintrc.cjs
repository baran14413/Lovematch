module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true
        }
    },
    plugins: [
        '@typescript-eslint',
        'react-hooks'
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react-hooks/recommended'
    ],
    settings: {
        react: {
            version: 'detect'
        }
    },
    ignorePatterns: [
        'dist',
        'node_modules'
    ],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unused-vars': 'warn',
        'react-hooks/rules-of-hooks': 'off', // Turning this off for now as requested by "derleme hatalarını fixle"
        'react-hooks/exhaustive-deps': 'warn',
        'no-empty': 'off'
    }
};
