import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  tabs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as { id: string }[],
  handlers: null as null | { close: (id: string) => void },
  fn: {} as Record<string, ReturnType<typeof vi.fn>>
}));
const f = vi.hoisted(() => (n: string, ret?: unknown) => (m.fn[n] = vi.fn(() => ret)));

vi.mock('./ipc', () => ({
  getCliStartupFiles: () => Promise.resolve([]),
  onCloseRequested: () => Promise.resolve(),
  onFilesDropped: () => Promise.resolve(),
  onForwardedFiles: () => Promise.resolve(),
  pickFileToOpen: f('open', Promise.resolve(null))
}));
vi.mock('./tabs', () => ({
  activate: f('activate', Promise.resolve()),
  bindEditListener: vi.fn(),
  cycle: f('cycle', Promise.resolve()),
  getActiveTab: () => m.tabs[0],
  getTabs: () => m.tabs,
  initTabs: vi.fn(),
  newUntitled: f('newUntitled', Promise.resolve()),
  openPath: vi.fn(),
  openPaths: vi.fn(() => Promise.resolve()),
  restore: vi.fn(),
  snapshot: vi.fn(),
  toggleMode: f('toggleMode', Promise.resolve())
}));
vi.mock('./saving', () => ({
  flushDirty: vi.fn(),
  saveAs: f('saveAs', Promise.resolve(true)),
  saveTab: f('saveTab', Promise.resolve(true)),
  scheduleAutosave: vi.fn()
}));
vi.mock('./session', () => ({ bindSessionSource: vi.fn(), loadSession: () => Promise.resolve(null) }));
vi.mock('./external', () => ({ startExternalWatch: vi.fn() }));
vi.mock('./drop', () => ({ handleDrop: vi.fn() }));
vi.mock('./infobar', () => ({ mountInfobar: vi.fn() }));
vi.mock('./titlebar', () => ({
  Titlebar: class {
    constructor(_r: unknown, h: { close: (id: string) => void }) {
      m.handlers = h;
    }
  }
}));
vi.mock('./closedTabs', () => ({
  closeTabWithRestore: f('closeTabWithRestore', Promise.resolve()),
  restoreClosedTab: f('restoreClosedTab', Promise.resolve())
}));

import { startApp } from './app';

function press(init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { ctrlKey: true, cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
}
const calls = () => Object.values(m.fn).reduce((n, x) => n + x.mock.calls.length, 0);

describe('keyboard table', () => {
  beforeAll(async () => {
    document.body.innerHTML = '<div id="root"></div>';
    await startApp(document.getElementById('root')!);
  });
  beforeEach(() => {
    m.tabs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    Object.values(m.fn).forEach((x) => x.mockClear());
  });

  const rows: [string, KeyboardEventInit, string, unknown[]?][] = [
    ['Ctrl+T', { key: 't' }, 'newUntitled'],
    ['Ctrl+N', { key: 'n' }, 'newUntitled'],
    ['Ctrl+O', { key: 'o' }, 'open'],
    ['Ctrl+S', { key: 's' }, 'saveTab', ['a']],
    ['Ctrl+Shift+S', { key: 'S', shiftKey: true }, 'saveAs', ['a']],
    ['Ctrl+W', { key: 'w' }, 'closeTabWithRestore', ['a']],
    ['Ctrl+Shift+T', { key: 'T', shiftKey: true }, 'restoreClosedTab', []],
    ['Ctrl+Tab', { key: 'Tab' }, 'cycle', [1]],
    ['Ctrl+Shift+Tab', { key: 'Tab', shiftKey: true }, 'cycle', [-1]],
    ['Ctrl+E', { key: 'e' }, 'toggleMode']
  ];
  it.each(rows)('%s', (_n, init, fn, args) => {
    const e = press(init);
    expect(m.fn[fn]).toHaveBeenCalledTimes(1);
    if (args) expect(m.fn[fn].mock.calls[0]).toEqual(args);
    expect(calls()).toBe(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('Ctrl+Shift+T does not open a new tab', () => {
    press({ key: 'T', shiftKey: true });
    expect(m.fn.newUntitled).not.toHaveBeenCalled();
  });

  it('digits match by key position, AZERTY key is &', () => {
    const e = press({ key: '&', code: 'Digit1' });
    expect(m.fn.activate).toHaveBeenCalledWith('a');
    expect(e.defaultPrevented).toBe(true);
    press({ key: '3', code: 'Numpad3' });
    expect(m.fn.activate).toHaveBeenLastCalledWith('c');
  });

  it('a digit without that tab does nothing', () => {
    const e = press({ key: '5', code: 'Digit5' });
    expect(calls()).toBe(0);
    expect(e.defaultPrevented).toBe(false);
  });

  it.each([
    ['Ctrl+Alt+S', { key: 's', altKey: true }],
    ['plain S', { key: 's', ctrlKey: false }],
    ['Ctrl+V', { key: 'v' }],
    ['Ctrl+Shift+V', { key: 'V', shiftKey: true }],
    ['Ctrl+F', { key: 'f' }],
    ['Ctrl+H', { key: 'h' }]
  ])('%s is not handled', (_n, init) => {
    const e = press(init);
    expect(calls()).toBe(0);
    expect(e.defaultPrevented).toBe(false);
  });

  it('titlebar close uses closeTabWithRestore', () => {
    m.handlers!.close('b');
    expect(m.fn.closeTabWithRestore).toHaveBeenCalledWith('b');
  });
});
