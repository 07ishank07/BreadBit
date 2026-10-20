import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/**/*.test.ts', 'apps/desktop/src/**/*.test.ts'], exclude: ['packages/circuit-renderer/**','node_modules/**','vendor/**'], environment: 'node' } });
