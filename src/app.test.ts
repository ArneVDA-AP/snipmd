import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
    moveActive: vi.fn(),
    saveSession: vi.fn(),
    bars: [] as { key: string; body?: HTMLElement }[],
    newUntitled: fn(),
    openPath: fn(),
    toggleMode: fn(),
    saveTab: fn(),
    saveAs: fn(),
    pickFileToOpen: vi.fn(async () => 'C:/n/picked.md'),
    closeTabWithRestore: fn(),
    restoreClosedTab: fn(),
    flushDirty: fn(),
    openPaths: fn(),
    newUntitledAtStart: 0,
    menu: null as null | ((name: string) => void),
    pasteText: null as null | ((text: string) => void),
    mac: false,
    beforeClose: null as null | (() => Promise<void>),
    beforeQuit: null as null | (() => Promise<void>),
    forwarded: null as null | ((paths: string[]) => void),
    opened: null as null | ((paths: string[]) => void),
    dropped: null as null | ((d: unknown) => void),
    handleDrop: vi.fn(async () => {})
  };
});
vi.mock('./ipc', () => ({
  getCliStartupFiles: async () => [],
  onCloseRequested: async (f: () => Promise<void>) => void (m.beforeClose = f),
  onQuitRequested: async (f: () => Promise<void>) => void (m.beforeQuit = f),
  onMenuCommand: async (f: (name: string) => void) => void (m.menu = f),
  onOpenedNotes: async (f: (paths: string[]) => void) => void (m.opened = f),
  onPasteText: async (f: (text: string) => void) => void (m.pasteText = f),
  onFilesDropped: async (f: (d: unknown) => void) => void (m.dropped = f),
  onForwardedFiles: async (f: (paths: string[]) => void) => void (m.forwarded = f),
  pickFileToOpen: m.pickFileToOpen,
  takeOpenedNotes: async () => ['/Users/x/finder.md'],
  windowBackdrop: async () => false
}));
vi.mock('./tabs', () => ({
  activate: m.activate,
  cycle: m.cycle,
  focusActive: m.focusPage,
  getActiveTab: () => m.tabs[0],
  getTabs: () => m.tabs,
  initTabs: () => {},
  moveActive: m.moveActive,
  moveTab: () => {},
  refreshRead: async () => {},
  startSessionWrites: () => {},
  newUntitled: m.newUntitled,
  openPath: m.openPath,
  openPaths: m.openPaths,
  preloadReader: () => {},
  restore: async () => {},
  toggleMode: m.toggleMode
}));
vi.mock('./saving', () => ({ flushDirty: m.flushDirty, saveAs: m.saveAs, saveTab: m.saveTab, scheduleAutosave: () => {} }));
vi.mock('./session', () => ({ loadSession: async () => ({ session: null, setAside: null }), scheduleSessionSave: m.saveSession }));
vi.mock('./external', () => ({ startExternalWatch: () => {} }));
vi.mock('./perf', () => ({ markReady: () => {}, markStep: () => {} }));
vi.mock('./drop', () => ({ handleDrop: m.handleDrop }));
vi.mock('./infobar', () => ({ mountInfobar: () => {}, focusInfobar: m.focusInfobar, showError: vi.fn(), showInfo: vi.fn((bar: { key: string; body?: HTMLElement }) => m.bars.push(bar)), clearInfo: vi.fn() }));
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
vi.mock('./platform', () => ({
  get IS_MAC() {
    return m.mac;
  },
  keys: (k: string) => k
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

let startupOpened: unknown[][] = [];
beforeAll(async () => {
  const root = document.createElement('div');
  document.body.append(root);
  await startApp(root);
  startupOpened = m.openPaths.mock.calls.slice();
  m.newUntitledAtStart = m.newUntitled.mock.calls.length;
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

  it('Ctrl+End and Ctrl+Left on the numpad with NumLock off stay editor keys', () => {
    for (const [key, code] of [['End', 'Numpad1'], ['ArrowLeft', 'Numpad4']]) {
      const e = press(key, { code });
      expect(e.defaultPrevented).toBe(false);
    }
    calledOnly(undefined as never);
  });

  it('Ctrl+5 with three tabs does nothing', () => {
    const e = press('5', { code: 'Digit5' });
    expect(e.defaultPrevented).toBe(false);
    calledOnly(undefined as never);
  });

  it('Ctrl+Shift+PageDown and PageUp move the active tab; a held key acts once', () => {
    expect(press('PageDown', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(m.moveActive).toHaveBeenLastCalledWith(1);
    press('PageUp', { shiftKey: true });
    expect(m.moveActive).toHaveBeenLastCalledWith(-1);
    press('PageDown', { shiftKey: true, repeat: true });
    expect(m.moveActive).toHaveBeenCalledTimes(2);
  });

  it('Ctrl+PageDown without Shift stays an editor key', () => {
    expect(press('PageDown').defaultPrevented).toBe(false);
    expect(m.moveActive).not.toHaveBeenCalled();
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
    ['Ctrl+Shift+V', 'V', { shiftKey: true }]
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

describe('WebView2 browser keys and menu', () => {
  it.each([
    ['F5', {}], ['F3', {}], ['F7', {}], ['r', { ctrlKey: true }], ['R', { ctrlKey: true, shiftKey: true }], ['p', { ctrlKey: true }],
    ['j', { ctrlKey: true }], ['u', { ctrlKey: true }], ['ArrowLeft', { altKey: true }], ['BrowserBack', {}], ['BrowserForward', {}], ['BrowserRefresh', {}]
  ] as const)('%s %o does nothing', (key, init) => {
    const e = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    calledOnly(undefined as never);
  });

  it('the browser menu opens only over text', () => {
    const at = (cls: string) => {
      const el = document.createElement('div');
      el.className = cls;
      document.body.append(el);
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      el.remove();
      return e.defaultPrevented;
    };
    expect(at('titlebar')).toBe(true);
    expect(at('workspace')).toBe(true);
    expect(at('cm-content')).toBe(false);
  });
});

describe('find in edit mode', () => {
  it.each([['f'], ['h']])('Ctrl+%s is CodeMirror\'s inside the note, ours outside it (no browser find bar)', (key) => {
    const ed = document.createElement('div');
    ed.className = 'cm-editor';
    const field = document.createElement('input');
    ed.append(field);
    document.body.append(ed);
    field.focus();
    expect(press(key).defaultPrevented).toBe(false);
    field.blur();
    expect(press(key).defaultPrevented).toBe(true);
    ed.remove();
    calledOnly(undefined as never);
  });
});

describe('lifecycle (SPEC §6.1, §11)', () => {
  it('builds the page with the elements the modules are mounted on', () => {
    for (const id of ['titlebar', 'infoTop', 'infoBottom', 'editorPane', 'readPane']) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('a window blur writes every dirty note', () => {
    window.dispatchEvent(new Event('blur'));
    expect(m.flushDirty).toHaveBeenCalledTimes(1);
  });

  it('a close waits for the flush, but not forever: a hung write must not keep the window open', async () => {
    vi.useFakeTimers();
    try {
      m.flushDirty.mockReturnValueOnce(new Promise(() => {}));
      let closed = false;
      void m.beforeClose!().then(() => (closed = true));
      await vi.advanceTimersByTimeAsync(0);
      expect(closed).toBe(false);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('files from a second instance, from Finder and from a drop reach the page', () => {
    m.forwarded!(['C:/n/a.md']);
    m.opened!(['/Users/x/b.md']);
    expect(m.openPaths.mock.calls).toEqual([[['C:/n/a.md']], [['/Users/x/b.md']]]);
    const d = { notes: [], images: ['C:/p.png'], x: 1, y: 2 };
    m.dropped!(d);
    expect(m.handleDrop).toHaveBeenCalledWith(d);
  });
});

describe('command menu (SPEC §4)', () => {
  it('Ctrl+Shift+P opens the command-menu bar, and Ctrl+P alone is still blocked', () => {
    expect(press('P', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(m.bars.map((b) => b.key)).toEqual(['command-menu']);
    expect(press('p').defaultPrevented).toBe(true);
    expect(m.bars).toHaveLength(1);
  });

  it('a menu command name runs through the registry', () => {
    m.menu!('tab-right');
    expect(m.moveActive).toHaveBeenCalledWith(1);
    m.menu!('toggle:nope');
    expect(m.moveActive).toHaveBeenCalledTimes(1);
  });

  it('a toggle row flips its setting and saves the session at once', () => {
    const body = m.bars[0].body!;
    const row = [...body.querySelectorAll('.cmdmenu-row')].find((r) => r.textContent?.includes('Line breaks'))!;
    expect(row.getAttribute('aria-checked')).toBe('false');
    (row as HTMLElement).click();
    expect(m.saveSession).toHaveBeenCalledWith({ immediate: true });
    const after = [...body.querySelectorAll('.cmdmenu-row')].find((r) => r.textContent?.includes('Line breaks'))!;
    expect(after.getAttribute('aria-checked')).toBe('true');
  });
});

describe('macOS (SPEC §13)', () => {
  it('a note Finder handed over before the page listened opens at start, without an empty tab', () => {
    expect(startupOpened).toEqual([[['/Users/x/finder.md']]]);
    expect(m.newUntitledAtStart).toBe(0);
  });

  it.each([
    ['new-tab', () => m.newUntitled, undefined],
    ['save', () => m.saveTab, 'a'],
    ['save-as', () => m.saveAs, 'a'],
    ['close-tab', () => m.closeTabWithRestore, 'a'],
    ['reopen-tab', () => m.restoreClosedTab, undefined],
    ['read-mode', () => m.toggleMode, undefined]
  ] as const)('the menu item %s runs the same command as its key', (name, f, arg) => {
    m.menu!(name);
    calledOnly(f());
    if (arg !== undefined) expect(f()).toHaveBeenCalledWith(arg);
  });

  it('an unknown menu id does nothing', () => {
    m.menu!('nope');
    calledOnly(undefined as never);
  });

  it('a quit flushes the same way as closing the window', async () => {
    expect(m.beforeQuit).toBe(m.beforeClose);
    await m.beforeQuit!();
    expect(m.flushDirty).toHaveBeenCalledTimes(1);
  });
});

describe('macOS keys (SPEC §13)', () => {
  beforeEach(() => void (m.mac = true));
  afterEach(() => void (m.mac = false));
  const cmd = { metaKey: true, ctrlKey: false };

  it.each([
    ['s', cmd, () => m.saveTab],
    ['w', cmd, () => m.closeTabWithRestore],
    ['Tab', { ctrlKey: true }, () => m.cycle]
  ] as const)('%s %o runs its command', (key, init, f) => {
    expect(press(key, init).defaultPrevented).toBe(true);
    calledOnly(f());
  });

  it.each([
    ['e', { ctrlKey: true }, 'Control keeps its text bindings (end of line)'],
    ['p', { ctrlKey: true }, 'Control+P is previous line, not print'],
    ['h', cmd, 'Cmd+H hides the app, through the menu'],
    ['Tab', cmd, 'Cmd+Tab belongs to the system']
  ] as const)('%s %o is left alone: %s', (key, init, _why) => {
    expect(press(key, init).defaultPrevented).toBe(false);
    calledOnly(undefined as never);
  });

  it('Cmd+R does not reload', () => {
    expect(press('r', cmd).defaultPrevented).toBe(true);
  });
});
