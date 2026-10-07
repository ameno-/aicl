import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const serverPort = process.env['AICL_PORT'] ?? '5180';

export default defineConfig({
  root: path.resolve(root, 'web'),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', 'lucide-react', 'motion'],
    // Exact matches: '@aicl/react/markdown' must not resolve through '@aicl/react'.
    alias: [
      { find: /^@aicl\/core$/, replacement: path.resolve(root, '../../packages/core/src/index.ts') },
      { find: /^@aicl\/react\/markdown$/, replacement: path.resolve(root, '../../packages/react/src/markdown.tsx') },
      { find: /^@aicl\/fx\/fx\.css$/, replacement: path.resolve(root, '../../packages/fx/src/fx.css') },
      { find: /^@aicl\/fx$/, replacement: path.resolve(root, '../../packages/fx/src/index.ts') },
      { find: /^@aicl\/react$/, replacement: path.resolve(root, '../../packages/react/src/index.ts') },
    ],
  },
  build: {
    outDir: path.resolve(root, 'dist'),
    emptyOutDir: true,
    // gallery.html: every @aicl/fx component in every state, for review.
    rollupOptions: { input: { main: path.resolve(root, 'web/index.html'), gallery: path.resolve(root, 'web/gallery.html') } },
  },
  server: {
    port: Number(process.env['AICL_WEB_PORT'] ?? '5181'),
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${serverPort}`, changeOrigin: true },
      '/ws': { target: `ws://127.0.0.1:${serverPort}`, ws: true },
    },
  },
});
