import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ perfMark: vi.fn(async (_name: string, _ms?: number, _epoch?: number) => true) }));
vi.mock('./ipc', () => ({ perfMark: m.perfMark, toAssetUrl: (p: string) => `http://asset.localhost/${p}` }));

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const decode = HTMLImageElement.prototype.decode;

beforeEach(() => {
  vi.resetModules();
  m.perfMark.mockClear();
  document.body.replaceChildren();
  HTMLImageElement.prototype.decode = () => Promise.resolve();
});
afterEach(() => {
  HTMLImageElement.prototype.decode = decode;
});

function widget(...paths: string[]): void {
  const w = document.createElement('div');
  w.className = 'inline-img-widget';
  for (const p of paths) {
    const img = document.createElement('img');
    img.src = `http://asset.localhost/${p}`;
    w.append(img);
  }
  document.body.append(w);
}

describe('perf marks', () => {
  it('ready is sent once, after a frame, with no time (Rust measures from process start)', async () => {
    const { markReady } = await import('./perf');
    markReady();
    expect(m.perfMark).not.toHaveBeenCalled();
    await frame();
    await frame();
    expect(m.perfMark).toHaveBeenCalledWith('ready');
  });

  it('with tracing on, ready is followed by the page start as a wall-clock time', async () => {
    const { markReady } = await import('./perf');
    markReady();
    await frame();
    await frame();
    const page = m.perfMark.mock.calls.find(([name]) => name === 'page');
    expect(page).toEqual(['page', undefined, performance.timeOrigin]);
  });

  it('with tracing off, ready sends nothing more', async () => {
    m.perfMark.mockResolvedValueOnce(false);
    const { markReady } = await import('./perf');
    markReady();
    await frame();
    await frame();
    expect(m.perfMark.mock.calls.map(([name]) => name)).toEqual(['ready']);
  });

  it('with tracing on, paste is timed from the event to the decoded image of that path', async () => {
    const { markPasteVisible, markReady } = await import('./perf');
    markReady();
    await frame();
    await frame();
    m.perfMark.mockClear();
    markPasteVisible('C:/s/a.png', performance.now());
    widget('C:/s/b.png', 'C:/s/a.png');
    for (let i = 0; i < 6; i++) await frame();
    expect(m.perfMark).toHaveBeenCalledTimes(1);
    const [name, ms] = m.perfMark.mock.calls[0];
    expect(name).toBe('paste');
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('with tracing off, a paste is not followed at all', async () => {
    m.perfMark.mockResolvedValueOnce(false);
    const { markPasteVisible, markReady } = await import('./perf');
    markReady();
    await frame();
    await frame();
    m.perfMark.mockClear();
    markPasteVisible('C:/s/a.png', performance.now());
    widget('C:/s/a.png');
    for (let i = 0; i < 6; i++) await frame();
    expect(m.perfMark).not.toHaveBeenCalled();
  });
});
