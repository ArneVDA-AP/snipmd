import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ perfMark: vi.fn(async () => {}) }));
vi.mock('./ipc', () => ({ perfMark: m.perfMark, toAssetUrl: (p: string) => `http://asset.localhost/${p}` }));

import { markPasteVisible, markReady } from './perf';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

beforeEach(() => {
  m.perfMark.mockClear();
  document.body.replaceChildren();
});

describe('perf marks', () => {
  it('ready is sent once, after a frame, with no time (Rust measures from process start)', async () => {
    markReady();
    expect(m.perfMark).not.toHaveBeenCalled();
    await frame();
    await frame();
    expect(m.perfMark).toHaveBeenCalledWith('ready', undefined);
  });

  it('paste is timed from the event to the decoded image of that path', async () => {
    HTMLImageElement.prototype.decode = () => Promise.resolve();
    const start = performance.now();
    markPasteVisible('C:/s/a.png', start);
    const w = document.createElement('div');
    w.className = 'inline-img-widget';
    const other = document.createElement('img');
    other.src = 'http://asset.localhost/C:/s/b.png';
    const img = document.createElement('img');
    img.src = 'http://asset.localhost/C:/s/a.png';
    w.append(other, img);
    document.body.append(w);
    for (let i = 0; i < 4; i++) await frame();
    expect(m.perfMark).toHaveBeenCalledTimes(1);
    const [name, ms] = m.perfMark.mock.calls[0] as unknown as [string, number];
    expect(name).toBe('paste');
    expect(ms).toBeGreaterThanOrEqual(0);
  });
});
