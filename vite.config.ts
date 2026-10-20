import { defineConfig } from 'vitest/config';

// Tauri expects a fixed dev port (tauri.conf.json devUrl).
export default defineConfig({
  clearScreen: false,
  server: { port: 3000, strictPort: true },
  build: { target: 'es2022' },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] }
});
