/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: 'npm',
  testRunner: 'command',
  commandRunner: {
    // Narrow suite keeps mutation runtime practical in CI.
    // Use local bin (not npx) to avoid wrapper/package-manager interference.
    command:
      './node_modules/.bin/vitest run --no-file-parallelism apps/api/tests/unit/events/period.test.ts apps/api/tests/unit/events/quest-claim.service.test.ts apps/web/tests/security/safeMarkdown.test.ts',
  },
  mutate: [
    'apps/api/src/modules/events/period.ts',
    'apps/api/src/modules/events/quest-claim.service.ts',
    'apps/web/src/lib/safeMarkdown.ts',
  ],
  reporters: ['clear-text', 'html', 'json'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  // Fail CI when critical-module mutation score drops below production bar.
  thresholds: { high: 80, low: 60, break: 80 },
  concurrency: 4,
  timeoutMS: 30_000,
  dryRunTimeoutMinutes: 3,
  ignoreStatic: true,
  // Cap work for CI practicality; expand locally with MUTATE_ALL=true if needed.
  mutator: {
    excludedMutations: ['StringLiteral', 'ObjectLiteral'],
  },
};
