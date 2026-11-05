import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { coverageDefaults } from '../../vitest.shared.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root,
  test: {
    name: '@mll/logging',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    coverage: {
      ...coverageDefaults,
      include: ['src/**/*.ts'],
    },
  },
});
