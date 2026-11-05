import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { coverageDefaults } from '../../vitest.shared.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root,
  test: {
    name: '@mll/worker',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.ts'],
      exclude: [
        ...(coverageDefaults.exclude ?? []),
        'src/main.ts',
        'src/workers/index.ts',
        'src/lib/prisma.ts',
        'src/lib/redis.ts',
        'src/modules/email/transports/**',
        'src/config/env.ts',
      ],
    },
  },
});
