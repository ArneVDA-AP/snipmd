import { defineConfig, type Plugin } from 'vitest/config';

/**
 * SPEC §9: the JS loaded at startup is the entry chunk and every chunk it imports statically
 * (index.html preloads those). A language parser or read mode that slips in through a static import
 * fails the build here, wherever it lands; measuring only index-*.js once missed a 200 kB preload.
 */
const STARTUP_BUDGET = 440_000;

function startupBudget(): Plugin {
  return {
    name: 'startup-budget',
    apply: 'build',
    generateBundle(_, bundle) {
      const seen = new Set<string>();
      const visit = (file: string): number => {
        const chunk = bundle[file];
        if (seen.has(file) || chunk?.type !== 'chunk') return 0;
        seen.add(file);
        return chunk.code.length + chunk.imports.reduce((n, f) => n + visit(f), 0);
      };
      const entries = Object.values(bundle).filter((c) => c.type === 'chunk' && c.isEntry);
      const bytes = entries.reduce((n, c) => n + visit(c.fileName), 0);
      if (bytes > STARTUP_BUDGET) this.error(`startup JS is ${bytes} bytes, over the ${STARTUP_BUDGET} budget: ${[...seen].join(', ')}`);
    }
  };
}

// Tauri expects a fixed dev port (tauri.conf.json devUrl).
export default defineConfig({
  clearScreen: false,
  server: { port: 3000, strictPort: true },
  build: { target: 'es2022' },
  plugins: [startupBudget()],
  // css: the contrast test reads main.css as text.
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'], css: { include: [/main\.css/] } }
});
