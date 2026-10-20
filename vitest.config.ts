import { defineConfig } from 'vitest/config';
export default defineConfig({ resolve: { alias: { '@velxio': new URL('./vendor/velxio/frontend/src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') } }, test: { include: ['packages/**/*.test.ts', 'apps/desktop/src/**/*.test.ts'], exclude: ['packages/circuit-renderer/**', 'node_modules/**', 'vendor/**'], environment: 'node' } });
