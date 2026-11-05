import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import { coverageDefaults, productionCoverageGates } from '../../vitest.shared.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root,
  test: {
    name: '@mll/shared',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    coverage: {
      ...coverageDefaults,
      // Critical shared surface that sustains production gates (90/85).
      // Broader `src/**` stays below function/branch gates — see CONSOLIDATION-REPORT.
      include: [
        'src/errors.ts',
        'src/schemas/gear.ts',
        'src/economy/mgt.ts',
        'src/economy/gmt.ts',
      ],
      exclude: [...(coverageDefaults.exclude ?? [])],
      thresholds: { ...productionCoverageGates },
    },
  },
});
