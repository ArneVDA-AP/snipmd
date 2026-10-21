// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EditorState } from '@codemirror/state';

vi.mock('../ipc', () => ({
  resolveAssetPath: vi.fn(),
  toAssetUrl: vi.fn((p: string) => `asset://${p}`)
}));

import { resolveAssetPath } from '../ipc';
import { getState, initRegistry, setState } from './registry';
import { createEditorState } from './setup';
import { imageWidgetField, primeAssetCache } from './imageWidget';

const resolve = vi.mocked(resolveAssetPath);
const flush = () => new Promise((r) => setTimeout(r, 0));
let n = 0;
const newId = () => `tab${++n}-${Math.random()}`;

function widgets(state: EditorState): HTMLElement[] {
  const out: HTMLElement[] = [];
  const it = state.field(imageWidgetField).iter();
  while (it.value) {
    out.push((it.value.spec.widget as { toDOM(): HTMLElement }).toDOM());
    it.next();
  }
  return out;
}

function open(id: string, doc: string): EditorState {
  const st = createEditorState(id, doc);
  setState(id, st);
  return st;
}

beforeEach(() => {
  resolve.mockReset();
  initRegistry({ filePathOf: () => '/notes/a.md', onChange: () => {} });
});

describe('imageWidget', () => {
  it('gives two widgets for two images on one line', () => {
    resolve.mockReturnValue(new Promise(() => {}));
    const st = open(newId(), '![a](one.png) text ![b](<two words.png>)');
    const w = widgets(st);
    expect(w.length).toBe(2);
    expect(w[0].textContent).toBe('Loading image: one.png');
    expect(w[1].textContent).toBe('Loading image: two words.png');
  });

  it('gives no widget for images in fenced or inline code', () => {
    const st = open(newId(), '```\n![a](x.png)\n```\n\n`![b](y.png)`\n');
    expect(widgets(st).length).toBe(0);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('looks up a failing image once and shows the placeholder', async () => {
    resolve.mockRejectedValue(new Error('nope'));
    const id = newId();
    open(id, '![a](gone.png)');
    await flush();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(widgets(getState(id)!)[0].textContent).toBe('Image not found: gone.png');
    const { applyToTab } = await import('./registry');
    applyToTab(id, { changes: { from: 0, insert: 'x\n' } });
    applyToTab(id, { changes: { from: 0, insert: 'y\n' } });
    await flush();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(widgets(getState(id)!)[0].textContent).toBe('Image not found: gone.png');
  });

  it('looks up untitled tabs separately with their own tab ids', async () => {
    initRegistry({ filePathOf: () => null, onChange: () => {} });
    resolve.mockResolvedValue('/scratch/x.png');
    const a = newId();
    const b = newId();
    open(a, '![](untitled.assets/x.png)');
    open(b, '![](untitled.assets/x.png)');
    await flush();
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve.mock.calls.map((c) => c[0]).sort()).toEqual([a, b].sort());
  });

  it('shows a primed image without a lookup', () => {
    const id = newId();
    primeAssetCache(id, 'p.png', '/notes/p.png');
    const st = open(id, '![alt](p.png)');
    const img = widgets(st)[0].querySelector('img');
    expect(img?.getAttribute('src')).toBe('asset:///notes/p.png');
    expect(resolve).not.toHaveBeenCalled();
  });
});
