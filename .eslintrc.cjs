/** Root ESLint config — applied across the monorepo. */
module.exports = {
  root: true,
  env: { node: true, es2022: true, browser: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    'apps/contracts/artifacts/',
    'apps/contracts/cache/',
    'apps/contracts/typechain-types/',
    'output/',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.property.name='$queryRawUnsafe']",
        message: 'Use prisma.$queryRaw with template strings or a typed repository method. Raw unsafe queries can introduce SQL injection.',
      },
      {
        selector:
          "CallExpression[callee.property.name='$executeRawUnsafe']",
        message: 'Use prisma.$executeRaw with template strings or a typed repository method.',
      },
      {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'dangerouslySetInnerHTML is forbidden. Sanitize through lib/sanitize.ts if rich HTML is really needed.',
      },
      {
        selector: "CallExpression[callee.name='eval']",
        message: 'eval() is forbidden.',
      },
      {
        selector: "NewExpression[callee.name='Function']",
        message: 'new Function() is forbidden.',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },
  ],
};
