import { defineConfig } from 'vitest/config';

// Tauri expects a fixed dev port (tauri.conf.json devUrl).
export default defineConfig({
  clearScreen: false,
  server: { port: 3000, strictPort: true },
  build: { target: 'es2022' },
  // css: the contrast test reads main.css as text.
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], css: { include: [/main\.css/] } }
});
