import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode, isSsrBuild }) => ({
  // `npm run build:demo` makes a static preview with relative asset paths.
  base: mode === 'demo' ? './' : '/',
  // The server bundle (npm run build) needs no copy of public/; the client build serves it.
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', copyPublicDir: !isSsrBuild },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));
