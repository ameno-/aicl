import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@aicl/core': path.resolve(root, '../../packages/core/src/index.ts'),
      '@aicl/react': path.resolve(root, '../../packages/react/src/index.ts'),
    },
  },
  server: {
    port: 5179,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5174',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        ws: false,
      },
    },
  },
});
