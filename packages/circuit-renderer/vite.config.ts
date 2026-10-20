import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'preview-dist', chunkSizeWarningLimit: 1100 },
  esbuild: { jsx: 'automatic' },
});
