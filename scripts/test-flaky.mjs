#!/usr/bin/env node
/**
 * Run critical smoke suite N times and write a flaky report.
 * Exit 1 if any run fails.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runs = Number(process.env.FLAKY_RUNS ?? 5);
const reportDir = path.join(root, 'reports');
mkdirSync(reportDir, { recursive: true });

const results = [];
let failures = 0;

for (let i = 1; i <= runs; i += 1) {
  const started = Date.now();
  const proc = spawnSync('npm', ['run', 'test:smoke'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: true,
  });
  const ok = proc.status === 0;
  if (!ok) failures += 1;
  results.push({
    run: i,
    ok,
    exitCode: proc.status,
    durationMs: Date.now() - started,
    stderrTail: (proc.stderr || '').split('\n').slice(-20).join('\n'),
  });
  console.log(`[flaky] run ${i}/${runs}: ${ok ? 'PASS' : 'FAIL'} (${results[i - 1].durationMs}ms)`);
}

const reportPath = path.join(reportDir, 'flaky-report.md');
const lines = [
  '# Flaky detection report',
  '',
  `- Suite: \`npm run test:smoke\``,
  `- Runs: ${runs}`,
  `- Failures: ${failures}`,
  `- Generated: ${new Date().toISOString()}`,
  '',
  '| Run | Result | Duration (ms) | Exit |',
  '|-----|--------|---------------|------|',
  ...results.map(
    (r) => `| ${r.run} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.durationMs} | ${r.exitCode} |`,
  ),
  '',
];

if (failures > 0) {
  lines.push('## Failure details', '');
  for (const r of results.filter((x) => !x.ok)) {
    lines.push(`### Run ${r.run}`, '```', r.stderrTail || '(no stderr)', '```', '');
  }
  lines.push(
    '## Possible causes',
    '',
    '- Shared resource races (unlikely in smoke — unit-only)',
    '- Environment pollution (TURNSTILE, env secrets)',
    '- Non-deterministic timers/mocks',
    '',
  );
} else {
  lines.push('No inconsistent failures detected in this batch.', '');
}

writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log(`[flaky] report → ${reportPath}`);
process.exit(failures > 0 ? 1 : 0);
