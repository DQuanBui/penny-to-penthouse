import { defineConfig } from 'vite';

// base './' keeps every asset URL relative, so the build works on
// GitHub Pages under any repository name.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
});
