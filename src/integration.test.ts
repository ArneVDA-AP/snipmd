// Tabs, the editor registry, paste and saving run for real here; only the Rust side (ipc), the
// info bar and read mode are stubbed. The module tests stub their neighbours, so this file is where
// the seams between them are checked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionFile, TabState } from './types';

vi.mock('./ipc', () => ({
  readNote: vi.fn(),
  writeNote: vi.fn(),
  saveImage: vi.fn(),
  importImage: vi.fn(),
  statNote: vi.fn(),
  resolveAssetPath: vi.fn(() => new Promise(() => {})),
  toAssetUrl: (p: string) => `asset://${p}`,
  claimNewNote: vi.fn(),
  pickSavePath: vi.fn(),
  promoteUntitled: vi.fn(async () => null),
  copyAssets: vi.fn(async () => null),
  saveSessionRaw: vi.fn(async () => {}),
  loadSessionRaw: vi.fn(async () => ({ raw: null, setAside: null })),
  perfMark: vi.fn(async () => false)
}));
vi.mock('./infobar', () => ({ showError: vi.fn(), showInfo: vi.fn(), clearInfo: vi.fn(), clearTabInfo: vi.fn() }));
vi.mock('./preview/render', () => ({ renderRead: vi.fn(async () => document.createElement('article')) }));
vi.mock('./firstSaveBar', () => ({ askFirstSave: vi.fn() }));

import { claimNewNote, promoteUntitled, readNote, saveImage, saveSessionRaw, writeNote } from './ipc';
import { showError } from './infobar';
import { askFirstSave } from './firstSaveBar';

const note = (text: string) => ({ text, format: { crlf: false, bom: false }, stamp: { mtimeMs: 1, size: text.length } });
const tab = (o: Partial<TabState>): TabState => ({
  id: 'x', title: 'x', filePath: null, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: null, format: null, ...o
});
const session = (tabs: TabState[]): SessionFile => ({
  version: 3, activeTabId: tabs[0].id, untitledCounter: 1, lastFolder: null, tabs, closedTabs: []
});
const flush = () => new Promise((r) => setTimeout(r, 0));

// Each test gets fresh modules, so module state (the session source, the tab list) starts empty.
let tabsMod: typeof import('./tabs');
let reg: typeof import('./editor/registry');
let saving: typeof import('./saving');
let closeTab: typeof tabsMod.closeTab, getTab: typeof tabsMod.getTab, reopenClosed: typeof tabsMod.reopenClosed;
let restore: typeof tabsMod.restore, textOf: typeof tabsMod.textOf, flushDirty: typeof saving.flushDirty;

/** Pastes an image whose bytes arrive only when the returned function is called. */
function pasteImageLater(): () => void {
  let release!: () => void;
  const bytes = new Promise<ArrayBuffer>((r) => (release = () => r(new ArrayBuffer(4))));
  const file = { type: 'image/png', arrayBuffer: () => bytes };
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', {
    value: { getData: () => '', items: [{ type: 'image/png', getAsFile: () => file }] }
  });
  reg.getView()!.contentDOM.dispatchEvent(ev);
  return release;
}

let n = 0;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  tabsMod = await import('./tabs');
  saving = await import('./saving');
  reg = await import('./editor/registry');
  ({ closeTab, getTab, reopenClosed, restore, textOf } = tabsMod);
  ({ flushDirty } = saving);
  document.body.innerHTML = '<div id="e"></div><div id="r"></div>';
  tabsMod.initTabs({ editor: document.getElementById('e')!, read: document.getElementById('r')! }, { render: vi.fn() } as never, saving.scheduleAutosave);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.mocked(writeNote).mockImplementation(async (_p, text) => ({ written: { mtimeMs: 2, size: text.length } }));
  n++;
});

describe('paste, close and save together', () => {
  it('a screenshot pasted just before Ctrl+W on a saved note goes next to the note and is written to it', async () => {
    const id = `p${n}`;
    vi.mocked(readNote).mockResolvedValue(note('note'));
    vi.mocked(saveImage).mockResolvedValue({ link: 'n.assets/s.png', absPath: 'C:/n/n.assets/s.png' });
    await restore(session([tab({ id, title: 'n.md', filePath: 'C:/n/n.md' }), tab({ id: `q${n}`, content: 'other' })]));

    const release = pasteImageLater();
    await closeTab(id);
    release();
    await flush();
    await flush();

    expect(saveImage).toHaveBeenCalledWith(id, 'C:/n/n.md', expect.any(Uint8Array));
    const closed = getTab(id)!;
    expect(textOf(closed)).toContain('![snip](n.assets/s.png)');
    expect(textOf(closed)).not.toContain('untitled.assets');

    await flushDirty();
    expect(writeNote).toHaveBeenCalledWith('C:/n/n.md', expect.stringContaining('n.assets/s.png'), expect.anything(), expect.anything());
    expect(getTab(id)!.dirty).toBe(false);
    expect(showError).not.toHaveBeenCalled();
  });

  it('a closed tab with its late screenshot comes back with Ctrl+Shift+T', async () => {
    const id = `u${n}`;
    vi.mocked(saveImage).mockResolvedValue({ link: 'untitled.assets/s.png', absPath: 'C:/scratch/s.png' });
    await restore(session([tab({ id, content: 'draft' }), tab({ id: `v${n}`, content: 'other' })]));

    const release = pasteImageLater();
    await closeTab(id);
    release();
    await flush();
    await flush();

    expect(saveImage).toHaveBeenCalledWith(id, null, expect.any(Uint8Array));
    const back = await reopenClosed(id);
    expect(back?.id).toBe(id);
    expect(textOf(back!)).toContain('![snip](untitled.assets/s.png)');
  });
});

describe('startup, restore and reopen', () => {
  it('no session write before the startup tabs are in place: a blur during restore keeps the old session', async () => {
    vi.mocked(readNote).mockReturnValue(new Promise(() => {}));
    void restore(session([tab({ id: 's1', title: 'n.md', filePath: 'C:/n/n.md' })]));
    await flushDirty();
    expect(saveSessionRaw).not.toHaveBeenCalled();
  });

  it('writes start with startSessionWrites', async () => {
    await restore(session([tab({ id: 's2', content: 'draft' })]));
    tabsMod.startSessionWrites();
    await flushDirty();
    expect(vi.mocked(saveSessionRaw).mock.calls.at(-1)![0]).toContain('draft');
  });

  it('a hung read of a file from the command line does not stop session writes', async () => {
    await restore(session([tab({ id: 'c1', content: 'draft' })]));
    tabsMod.startSessionWrites();
    vi.mocked(readNote).mockReturnValue(new Promise(() => {}));
    void tabsMod.openPaths(['C:/n/hung.md']);
    reg.applyToTab('c1', { changes: { from: 5, insert: ' typed' } });
    await flushDirty();
    expect(vi.mocked(saveSessionRaw).mock.calls.at(-1)![0]).toContain('draft typed');
  });

  it('an id in both lists of an old session keeps both texts and edits of the open tab survive its close', async () => {
    const s = session([tab({ id: 'dup', content: 'live' }), tab({ id: 'k', content: 'k' })]);
    s.closedTabs = [{ tab: tab({ id: 'dup', content: 'old' }), closedAt: Date.now() - 1000 }];
    await restore(s);
    tabsMod.startSessionWrites();
    reg.applyToTab('dup', { changes: { from: 4, insert: ' edit' } });
    await tabsMod.activate('k');
    await closeTab('dup');
    const closed = tabsMod.snapshot().closedTabs.map((c) => c.tab.content).sort();
    expect(closed).toEqual(['live edit', 'old']);
  });

  it('a second Ctrl+Shift+T while the first reads its file reopens the next closed tab', async () => {
    let release!: () => void;
    vi.mocked(readNote).mockResolvedValueOnce(note('n1')); // restore
    await restore(session([tab({ id: 'a', content: 'a' }), tab({ id: 'n1', title: 'n1.md', filePath: 'C:/n/n1.md' }), tab({ id: 'u2', content: 'u2' })]));
    await closeTab('u2');
    await closeTab('n1');
    vi.mocked(readNote).mockReturnValueOnce(new Promise((r) => (release = () => r(note('n1')))));
    const first = reopenClosed();
    const second = await reopenClosed();
    release();
    expect((await first)?.id).toBe('n1');
    expect(second?.id).toBe('u2');
  });

  it("a first save waits for its own tab's image saves only: a hung save elsewhere does not block it", async () => {
    await restore(session([tab({ id: 'fa', content: '# Title' }), tab({ id: 'fb', content: 'b' })]));
    void reg.trackImageSave('fb', new Promise(() => {}));
    vi.mocked(askFirstSave).mockResolvedValue({ folder: 'C:/n', name: 'title.md' });
    vi.mocked(claimNewNote).mockResolvedValue('C:/n/title.md');
    expect(await saving.saveTab('fa')).toBe(true);
    expect(promoteUntitled).toHaveBeenCalledWith('fa', 'C:/n/title.md');
  });
  it('a reopen whose file read fails stays closed, writes nothing and shows its text in a read-only copy', async () => {
    vi.mocked(readNote).mockResolvedValueOnce(note('mine')); // restore
    await restore(session([tab({ id: 'rf', title: 'rf.md', filePath: 'C:/n/rf.md' }), tab({ id: 'rk', content: 'k' })]));
    await closeTab('rf');
    vi.mocked(readNote).mockRejectedValueOnce(new Error('locked'));
    expect(await reopenClosed('rf')).toBeUndefined();
    expect(getTab('rf')!.closedAt).toBeDefined();
    expect(getTab('rf')!.dirty).toBe(false);
    expect(tabsMod.getTabs().map((t) => t.title)).toContain('rf.md (closed)');
    await flushDirty();
    expect(writeNote).not.toHaveBeenCalled();
  });

  it('a late reopen leaves the focus on a tab the user went to, but takes it when the shown tab was closed', async () => {
    vi.mocked(readNote).mockResolvedValue(note('t'));
    await restore(session([tab({ id: 'fa', content: 'a' }), tab({ id: 'fb', content: 'b' }), tab({ id: 'fn', title: 'fn.md', filePath: 'C:/n/fn.md' })]));
    await closeTab('fn');
    let release!: () => void;
    vi.mocked(readNote).mockReturnValueOnce(new Promise((r) => (release = () => r(note('t')))));
    const went = reopenClosed('fn');
    await tabsMod.activate('fb');
    release();
    await went;
    expect(tabsMod.getActiveTab()?.id).toBe('fb');

    await closeTab('fn');
    vi.mocked(readNote).mockReturnValueOnce(new Promise((r) => (release = () => r(note('t')))));
    const closedShown = reopenClosed('fn');
    await closeTab('fb');
    release();
    await closedShown;
    expect(tabsMod.getActiveTab()?.id).toBe('fn');
  });
});
