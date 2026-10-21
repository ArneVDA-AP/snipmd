// The top bar on macOS (SPEC §13): the system draws the window buttons, SnipMD leaves room for them.
import { expect, it, vi } from 'vitest';
import { macKeys } from './platform';

vi.mock('./ipc', () => ({ appWindow: {} }));
vi.mock('./platform', async (orig) => {
  const real = await orig<typeof import('./platform')>();
  return { ...real, IS_MAC: true, keys: real.macKeys };
});

import { Titlebar } from './titlebar';

it('draws no window buttons and starts with a draggable gap for the system ones', () => {
  const root = document.createElement('header');
  new Titlebar(root, { select: vi.fn(), open: vi.fn(), close: vi.fn(), newTab: vi.fn(), toggleMode: vi.fn() });
  expect(root.querySelector('.win-controls, .win-btn')).toBeNull();
  const first = root.firstElementChild!;
  expect(first.className).toBe('traffic-lights');
  expect(first.hasAttribute('data-tauri-drag-region')).toBe(true);
  expect(root.querySelector<HTMLElement>('.new-tab')!.title).toBe(`New tab (${macKeys('Ctrl+T')})`);
});
