import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { coverageDefaults, productionCoverageGates } from '../../vitest.shared.js';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root,
  plugins: [react()],
  resolve: {
    alias: {
      '@mll/shared': path.resolve(root, '../../packages/shared/src/index.ts'),
      react: path.resolve(root, '../../node_modules/react'),
      'react-dom': path.resolve(root, '../../node_modules/react-dom'),
    },
  },
  test: {
    name: '@mll/web',
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    globals: false,
    coverage: {
      ...coverageDefaults,
      include: [
        'src/lib/auth/storage.ts',
        'src/lib/api/client.ts',
        'src/lib/api/publicFetch.ts',
        'src/lib/socket/client.ts',
        'src/lib/safeMarkdown.ts',
        'src/hooks/useAuth.tsx',
        'src/app/transparencia/page.tsx',
        'src/app/avisos/page.tsx',
      ],
      // Allowlist measured surface: keep progressive gates until page tests are fully stable.
      // `productionCoverageGates` (90/85) applied to packages that sustain them (@mll/shared critical).
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 80,
        branches: 75,
      },
    },
  },
});

