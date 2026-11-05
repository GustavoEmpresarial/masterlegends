#!/usr/bin/env node
/**
 * Aggregate a lightweight observability summary after CI/local runs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reports = path.join(root, 'reports');
mkdirSync(reports, { recursive: true });

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function findCoverageSummaries() {
  const roots = [
    'packages/shared/coverage/coverage-final.json',
    'packages/logging/coverage/coverage-final.json',
    'apps/api/coverage/coverage-final.json',
    'apps/web/coverage/coverage-final.json',
    'apps/worker/coverage/coverage-final.json',
  ];
  return roots.filter((r) => existsSync(path.join(root, r)));
}

const flaky = existsSync(path.join(reports, 'flaky-report.md'))
  ? readFileSync(path.join(reports, 'flaky-report.md'), 'utf8')
  : null;
const mutation = existsSync(path.join(reports, 'mutation-report.md'))
  ? readFileSync(path.join(reports, 'mutation-report.md'), 'utf8')
  : null;
const perf = existsSync(path.join(reports, 'perf-smoke.md'))
  ? readFileSync(path.join(reports, 'perf-smoke.md'), 'utf8')
  : null;

const coverageFiles = findCoverageSummaries();
const out = [
  '# Test observability summary',
  '',
  `- Generated: ${new Date().toISOString()}`,
  '',
  '## Coverage artifacts',
  '',
  coverageFiles.length
    ? coverageFiles.map((f) => `- \`${f}\``).join('\n')
    : '- (none found — run `npm run test:coverage`)',
  '',
  '## Flaky detection',
  '',
  flaky ? 'See `reports/flaky-report.md`.' : '- Not run',
  '',
  '## Mutation',
  '',
  mutation ? 'See `reports/mutation-report.md`.' : '- Not run',
  '',
  '## Performance smoke',
  '',
  perf ? 'See `reports/perf-smoke.md`.' : '- Not run',
  '',
  '## Reports directory',
  '',
  ...readdirSync(reports).map((f) => `- \`${f}\``),
  '',
].join('\n');

writeFileSync(path.join(reports, 'observability.md'), out);
console.log('[observability] → reports/observability.md');
