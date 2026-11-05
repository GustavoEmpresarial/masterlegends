import type { CoverageV8Options } from 'vitest/node';

/**
 * Production coverage gates (centralized).
 * Applied per package when the measured include set can sustain them.
 * Packages still ramping (broad API surface) keep `coverageDefaults.thresholds`
 * until include/tests catch up — see docs/testing/STRATEGY.md.
 */
export const productionCoverageGates = {
  lines: 90,
  functions: 90,
  statements: 90,
  branches: 85,
} as const;

export const coverageDefaults: CoverageV8Options = {
  provider: 'v8',
  reporter: ['text', 'lcov', 'html', 'json'],
  exclude: ['tests/**', '**/*.test.ts', '**/*.test.tsx', 'dist/**'],
  reportsDirectory: './coverage',
  thresholds: {
    lines: 80,
    functions: 80,
    statements: 80,
    branches: 75,
  },
};
