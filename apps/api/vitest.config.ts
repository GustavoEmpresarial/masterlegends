import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { coverageDefaults } from '../../vitest.shared.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root,
  resolve: {
    alias: {
      '@mll/shared': path.resolve(root, '../../packages/shared/src/index.ts'),
      '@mll/logging': path.resolve(root, '../../packages/logging/src/index.ts'),
    },
  },
  test: {
    name: '@mll/api',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    // Integration suites share one Postgres/Redis — never run API files in parallel.
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    testTimeout: 30_000,
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.ts'],
      exclude: [
        ...(coverageDefaults.exclude ?? []),
        // Entry points and infra plugins — require a running server to test
        'src/main.ts',
        'src/app.ts',
        'src/plugins/**',
        // Gateway infra — requires live socket connections
        'src/gateway/socket.ts',
        'src/gateway/auth.middleware.ts',
        'src/gateway/rateLimit.ts',
        // Routes — covered by integration tests; exclude from unit coverage target
        'src/**/*.routes.ts',
        // Repositories — require a real database; covered by integration tests
        'src/**/*.repository.ts',
        // Chain listener — requires live blockchain RPC
        'src/modules/chain/**',
      ],
    },
  },
});
