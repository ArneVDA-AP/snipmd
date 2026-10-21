import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const fn = () => vi.fn(async () => {});
  return {
    tabs: [] as { id: string; mode?: string }[],
    focusBar: vi.fn(),
    focusPage: vi.fn(),
    focusInfobar: vi.fn(() => false),
    handlers: null as null | { select: (id: string) => void; close: (id: string) => void; newTab: () => void },
    activate: fn(),
    cycle: fn(),
    newUntitled: fn(),
    openPath: fn(),
    toggleMode: fn(),
    saveTab: fn(),
    saveAs: fn(),
    pickFileToOpen: vi.fn(async () => 'C:/n/picked.md'),
    closeTabWithRestore: fn(),
    restoreClosedTab: fn()
  };
});
vi.mock('./ipc', () => ({
  getCliStartupFiles: async () => [],
  onCloseRequested: async () => {},
  onFilesDropped: async () => {},
  onForwardedFiles: async () => {},
  pickFileToOpen: m.pickFileToOpen,
  windowBackdrop: async () => false
}));
vi.mock('./tabs', () => ({
  activate: m.activate,
  bindEditListener: () => {},
  cycle: m.cycle,
  focusActive: m.focusPage,
  getActiveTab: () => m.tabs[0],
  getTabs: () => m.tabs,
  initTabs: () => {},
  newUntitled: m.newUntitled,
  openPath: m.openPath,
  openPaths: async () => {},
  restore: async () => {},
  snapshot: () => ({}),
  toggleMode: m.toggleMode
}));
vi.mock('./saving', () => ({ flushDirty: async () => {}, saveAs: m.saveAs, saveTab: m.saveTab, scheduleAutosave: () => {} }));
vi.mock('./session', () => ({ bindSessionSource: () => {}, loadSession: async () => null }));
vi.mock('./external', () => ({ startExternalWatch: () => {} }));
vi.mock('./drop', () => ({ handleDrop: async () => {} }));
vi.mock('./infobar', () => ({ mountInfobar: () => {}, bindReturnFocus: () => {}, focusInfobar: m.focusInfobar }));
vi.mock('./titlebar', () => ({
  Titlebar: class {
    constructor(_root: HTMLElement, h: typeof m.handlers) {
      m.handlers = h;
    }
    focus() {
      m.focusBar();
    }
  }
}));
vi.mock('./closedTabs', () => ({ closeTabWithRestore: m.closeTabWithRestore, restoreClosedTab: m.restoreClosedTab }));

import { startApp } from './app';

const commands = [
  m.activate, m.cycle, m.newUntitled, m.openPath, m.toggleMode, m.saveTab, m.saveAs,
  m.pickFileToOpen, m.closeTabWithRestore, m.restoreClosedTab
];

function press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const calledOnly = (f: (typeof commands)[number]) => {
  for (const c of commands) expect(c).toHaveBeenCalledTimes(c === f ? 1 : 0);
};

beforeAll(async () => {
  await startApp(document.createElement('div'));
});

beforeEach(() => {
  m.tabs.splice(0, m.tabs.length, { id: 'a' }, { id: 'b' }, { id: 'c' });
  vi.clearAllMocks();
});

describe('keyboard table (SPEC §10)', () => {
  it.each([
    ['t', {}, () => m.newUntitled, undefined],
    ['n', {}, () => m.newUntitled, undefined],
    ['s', {}, () => m.saveTab, 'a'],
    ['S', { shiftKey: true }, () => m.saveAs, 'a'],
    ['w', {}, () => m.closeTabWithRestore, 'a'],
    ['T', { shiftKey: true }, () => m.restoreClosedTab, undefined],
    ['e', {}, () => m.toggleMode, undefined],
    ['Tab', {}, () => m.cycle, 1],
    ['Tab', { shiftKey: true }, () => m.cycle, -1],
    ['2', { code: 'Digit2' }, () => m.activate, 'b'],
    ['3', { code: 'Numpad3' }, () => m.activate, 'c'],
    ['s', { metaKey: true, ctrlKey: false }, () => m.saveTab, 'a']
  ] as const)('Ctrl+%s %o', (key, init, f, arg) => {
    const e = press(key, init);
    expect(e.defaultPrevented).toBe(true);
    calledOnly(f());
    if (arg !== undefined) expect(f()).toHaveBeenCalledWith(arg);
  });

  it('Ctrl+O opens the picked file', async () => {
    const e = press('o');
    expect(e.defaultPrevented).toBe(true);
    await flush();
    expect(m.pickFileToOpen).toHaveBeenCalledTimes(1);
    expect(m.openPath).toHaveBeenCalledWith('C:/n/picked.md');
  });

  it('Ctrl+1 matches on the key position (AZERTY gives key "&")', () => {
    const e = press('&', { code: 'Digit1' });
    expect(e.defaultPrevented).toBe(true);
    calledOnly(m.activate);
    expect(m.activate).toHaveBeenCalledWith('a');
  });

  it('Ctrl+5 with three tabs does nothing', () => {
    const e = press('5', { code: 'Digit5' });
    expect(e.defaultPrevented).toBe(false);
    calledOnly(undefined as never);
  });

  it('Ctrl+Shift+T restores and opens no new tab', () => {
    press('T', { shiftKey: true });
    calledOnly(m.restoreClosedTab);
    expect(m.restoreClosedTab).toHaveBeenCalledWith();
  });

  it.each([
    ['Ctrl+Alt+S', 's', { altKey: true }],
    ['plain S', 's', { ctrlKey: false }],
    ['Ctrl+V', 'v', {}],
    ['Ctrl+Shift+V', 'V', { shiftKey: true }],
    ['Ctrl+F', 'f', {}],
    ['Ctrl+H', 'h', {}]
  ] as const)('%s is not handled', (_name, key, init) => {
    const e = press(key, init);
    expect(e.defaultPrevented).toBe(false);
    calledOnly(undefined as never);
  });
});

describe('titlebar', () => {
  it('close (× and middle-click) uses closeTabWithRestore', () => {
    m.handlers!.close('b');
    calledOnly(m.closeTabWithRestore);
    expect(m.closeTabWithRestore).toHaveBeenCalledWith('b');
  });
  it('a held Ctrl+W or Ctrl+T acts once; a held Ctrl+Tab keeps cycling', async () => {
    const w = press('w', { repeat: true });
    press('t', { repeat: true });
    press('Tab', { repeat: true });
    await flush();
    expect(w.defaultPrevented).toBe(true);
    calledOnly(m.cycle);
  });
});

describe('find in read mode', () => {
  it.each([['f'], ['h']])('Ctrl+%s in a read tab goes back to writing first', async (key) => {
    m.tabs[0].mode = 'read';
    const e = press(key);
    expect(e.defaultPrevented).toBe(true);
    await flush();
    calledOnly(m.toggleMode);
  });
});

describe('F6 moves between page, info bar and tab strip', () => {
  const f6 = (shiftKey = false) => {
    const e = new KeyboardEvent('keydown', { key: 'F6', shiftKey, cancelable: true });
    window.dispatchEvent(e);
    return e;
  };

  it('from the page, with no bar, goes to the tab strip', () => {
    expect(f6().defaultPrevented).toBe(true);
    expect(m.focusInfobar).toHaveBeenCalledTimes(1);
    expect(m.focusBar).toHaveBeenCalledTimes(1);
  });

  it('from the page, with a bar, stops at the bar', () => {
    m.focusInfobar.mockReturnValueOnce(true);
    f6();
    expect(m.focusBar).not.toHaveBeenCalled();
  });

  it('Shift+F6 from the page goes the other way, to the tab strip first', () => {
    f6(true);
    expect(m.focusBar).toHaveBeenCalledTimes(1);
    expect(m.focusInfobar).not.toHaveBeenCalled();
  });

  it('from the tab strip, goes back to the page', () => {
    const header = document.createElement('header');
    header.className = 'titlebar';
    const tab = document.createElement('div');
    tab.tabIndex = 0;
    header.append(tab);
    document.body.append(header);
    tab.focus();
    f6();
    expect(m.focusPage).toHaveBeenCalledTimes(1);
    header.remove();
  });
});
