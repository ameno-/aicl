import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const serverPort = process.env['AICL_PORT'] ?? '5180';

export default defineConfig({
  root: path.resolve(root, 'web'),
  plugins: [react()],
  resolve: {
    alias: {
      '@aicl/core': path.resolve(root, '../../packages/core/src/index.ts'),
      '@aicl/react': path.resolve(root, '../../packages/react/src/index.ts'),
    },
  },
  build: { outDir: path.resolve(root, 'dist'), emptyOutDir: true },
  server: {
    port: Number(process.env['AICL_WEB_PORT'] ?? '5181'),
    strictPort: true,
    proxy: { '/api': { target: `http://127.0.0.1:${serverPort}`, changeOrigin: true } },
  },
});
