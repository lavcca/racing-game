import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    open: false
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
