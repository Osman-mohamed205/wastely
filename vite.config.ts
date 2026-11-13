import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Ignore the retired bundle copies left in public/assets; build from src only.
  publicDir: false,
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  build: {
    rollupOptions: {
      input: path.resolve(projectRoot, 'index.html'),
    },
  },
});
