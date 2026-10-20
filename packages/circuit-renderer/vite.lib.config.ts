import { defineConfig } from 'vite';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  build: {
    emptyOutDir: false,
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
    rollupOptions: { external: [/^react($|\/)/, /^react-dom($|\/)/, /^three($|\/)/, /^@react-three\/fiber/] },
  },
});
