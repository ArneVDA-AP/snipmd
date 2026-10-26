import { defineConfig } from 'vite';

// The Snip walk demo (index.html): the real app on a mocked Tauri, with buttons that play Snip's moments.
// Built with relative paths so the folder can be served from anywhere.
export default defineConfig({ root: __dirname, base: './', build: { target: 'es2022', emptyOutDir: true } });
