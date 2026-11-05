#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = path.join(root, 'reports/mutation/mutation.json');
const outPath = path.join(root, 'reports/mutation-report.md');
mkdirSync(path.dirname(outPath), { recursive: true });

if (!existsSync(jsonPath)) {
  writeFileSync(
    outPath,
    [
      '# Mutation testing report',
      '',
      '## Status: NOT RUN / MISSING ARTIFACT',
      '',
      'No `reports/mutation/mutation.json` found.',
      '',
      'Run: `npm run test:mutation`',
      '',
    ].join('\n'),
  );
  console.log('[mutation] missing json — stub report written');
  process.exit(0);
}

const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
const files = data.files ?? {};
const rows = Object.entries(files).map(([file, info]) => {
  const mutants = info.mutants ?? [];
  // Score against tested mutants only (exclude Ignored / NoCoverage).
  const tested = mutants.filter(
    (m) => m.status === 'Killed' || m.status === 'Survived' || m.status === 'Timeout',
  );
  const killed = tested.filter((m) => m.status === 'Killed').length;
  const survived = tested.filter((m) => m.status === 'Survived').length;
  const timeout = tested.filter((m) => m.status === 'Timeout').length;
  const total = tested.length;
  const score = total ? ((killed / total) * 100).toFixed(1) : 'n/a';
  return { file, killed, survived, timeout, total, score };
});

const all = rows.reduce(
  (a, r) => ({
    killed: a.killed + r.killed,
    survived: a.survived + r.survived,
    total: a.total + r.total,
  }),
  { killed: 0, survived: 0, total: 0 },
);
const score = all.total ? ((all.killed / all.total) * 100).toFixed(1) : 'n/a';

const md = [
  '# Mutation testing report',
  '',
  `- Generated: ${new Date().toISOString()}`,
  `- Mutation score: **${score}%**`,
  `- Killed: ${all.killed}`,
  `- Survived: ${all.survived}`,
  `- Total mutants: ${all.total}`,
  '',
  '| File | Score | Killed | Survived | Total |',
  '|------|-------|--------|----------|-------|',
  ...rows
    .sort((a, b) => Number(a.score) - Number(b.score))
    .map(
      (r) =>
        `| \`${r.file}\` | ${r.score}% | ${r.killed} | ${r.survived} | ${r.total} |`,
    ),
  '',
  'HTML: `reports/mutation/index.html`',
  '',
].join('\n');

writeFileSync(outPath, md);
console.log(`[mutation] report → ${outPath} (score ${score}%)`);
