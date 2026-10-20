import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const upstream = path.resolve(here, '../../vendor/velxio/frontend/src');
export default defineConfig({
  root: here,
  plugins: [react(), {
    name: 'breadbit-disable-upstream-metrics',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('/metricsService')) return path.resolve(here, 'src/integrations/metrics.ts');
    },
  }],
  resolve: { alias: { '@velxio': upstream, '@pro': path.join(upstream, '__pro_stub__') } },
  define: { 'import.meta.env.VITE_PRO_BUILD': 'false', 'import.meta.env.VITE_DESKTOP': 'false' },
  server: { host: '127.0.0.1', port: 1420, strictPort: true, proxy: process.env.VITE_BREADBIT_DEV_BACKEND === '1' ? { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false, ws: true } } : undefined, fs: { allow: [path.resolve(here, '../..')] } },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: { include: ['avr8js', 'rp2040js', '@wokwi/elements', 'littlefs'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
