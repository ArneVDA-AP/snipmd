import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionFile, TabState } from './types';

vi.mock('./ipc', () => ({ readNote: vi.fn(), saveSessionRaw: vi.fn(), loadSessionRaw: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), clearInfo: vi.fn(), clearTabInfo: vi.fn() }));
vi.mock('./preview/render', () => ({
  renderRead: vi.fn(async (_id: string, text: string) => Object.assign(document.createElement('article'), { textContent: text }))
}));
vi.mock('./titlebar', () => ({ Titlebar: class {} }));
vi.mock('./session', () => ({ bindSessionSource: vi.fn(), scheduleSessionSave: vi.fn() }));

import { readNote } from './ipc';
import { renderRead } from './preview/render';
import { clearTabInfo, showError } from './infobar';
import { scheduleSessionSave } from './session';
import {
  activate, closeTab, cycle, getActiveTab, getLastFolder, getTab, initTabs, loadText, markDirty, markSaved, newUntitled, openCopy, openPath,
  openPaths, openTab, reopenClosed, restore, setLastFolder, snapshot, getTabs, textOf, toggleMode, moveTab, moveActive, refreshRead
} from './tabs';
import { inConflict, setConflict } from './diskState';
import { applyToTab, filePathFor, getState, getView, trackImageSave } from './editor/registry';
import { parseSettings } from './settings';

const tab = (o: Partial<TabState>): TabState => ({
  id: 'x', title: 'x', filePath: null, content: '', dirty: false, mode: 'read', cursor: 0, scrollTop: 0, disk: null, format: null, ...o
});
const note = (text: string) => ({ text, format: { crlf: true, bom: false }, stamp: { mtimeMs: 1, size: text.length } });
const session = (tabs: TabState[], active = tabs[0]?.id ?? ''): SessionFile => ({
  version: 3, activeTabId: active, lastFolder: null, tabs, closedTabs: [], settings: parseSettings(undefined)
});

const render = vi.fn();
const onEdit = vi.fn();
const pane = (id: string) => document.getElementById(id)!;

beforeEach(() => {
  vi.mocked(readNote).mockReset();
  vi.mocked(showError).mockReset();
  vi.mocked(scheduleSessionSave).mockReset();
  render.mockReset();
  onEdit.mockReset();
  document.body.innerHTML = '<div id="e"></div><div id="r"></div>';
  initTabs({ editor: pane('e'), read: pane('r') }, { render } as never, onEdit);
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

describe('snapshot', () => {
  it('stores no text for a clean disk tab, the text for dirty and untitled tabs, and leaves live tabs alone', async () => {
    vi.mocked(readNote).mockResolvedValue(note('from disk'));
    await restore(session([
      tab({ id: 'c', title: 'c.md', filePath: 'C:/n/c.md' }),
      tab({ id: 'd', title: 'd.md', filePath: 'C:/n/d.md', dirty: true, content: 'unsaved' }),
      tab({ id: 'u', content: 'scratch' })
    ]));
    const live = getTabs().map((t) => t.content);
    const snap = snapshot();
    expect(snap.tabs.map((t) => t.content)).toEqual(['', 'unsaved', 'scratch']);
    expect(getTabs().map((t) => t.content)).toEqual(live);
    expect(getTabs()[0].content).toBe('from disk');
    expect(snap.tabs[0]).not.toBe(getTabs()[0]);
  });
});

describe('restore', () => {
  it('takes the text of a clean disk tab from readNote, not from the session', async () => {
    vi.mocked(readNote).mockResolvedValue(note('fresh'));
    await restore(session([tab({ id: 'fresh-c', filePath: 'C:/n/c.md', content: 'stale' })]));
    expect(textOf(getTabs()[0])).toBe('fresh');
  });

  it('keeps the session text of a dirty disk tab without reading it', async () => {
    await restore(session([tab({ id: 'd', filePath: 'C:/n/d.md', dirty: true, content: 'mine' })]));
    expect(readNote).not.toHaveBeenCalled();
    expect(textOf(getTabs()[0])).toBe('mine');
  });

  it('drops a tab whose read fails, keeps the others and shows one error with the first cause', async () => {
    vi.mocked(readNote).mockImplementation(async (p: string) => {
      if (p.includes('bad')) throw new Error(`gone ${p}`);
      return note('ok');
    });
    await restore(session([
      tab({ id: 'b1', title: 'bad1.md', filePath: 'C:/n/bad1.md' }),
      tab({ id: 'g', title: 'g.md', filePath: 'C:/n/g.md' }),
      tab({ id: 'b2', title: 'bad2.md', filePath: 'C:/n/bad2.md' })
    ], 'b1'));
    expect(getTabs().map((t) => t.id)).toEqual(['g']);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledWith('reopen bad1.md, bad2.md', new Error('gone C:/n/bad1.md'));
    expect(getActiveTab()?.id).toBe('g');
  });

  it('a cursor past the end of the file (the file shrank outside) is clamped, not an error', async () => {
    await restore(session([tab({ id: 'cl', mode: 'edit', content: 'abc', cursor: 999 })]));
    expect(getView()!.state.selection.main.head).toBe(3);
    expect(getActiveTab()?.id).toBe('cl');
  });

  it('shows the editor pane for a writing tab and the read pane for a reading one', async () => {
    await restore(session([tab({ id: 'pe', mode: 'edit', content: 'e' }), tab({ id: 'pr', mode: 'read', content: 'r' })]));
    expect([pane('e').hidden, pane('r').hidden]).toEqual([false, true]);
    await activate('pr');
    expect([pane('e').hidden, pane('r').hidden]).toEqual([true, false]);
    expect(pane('r').textContent).toBe('r');
  });

  it('opens a new untitled tab when every tab failed', async () => {
    vi.mocked(readNote).mockRejectedValue(new Error('gone'));
    await restore(session([tab({ id: 'b', title: 'b.md', filePath: 'C:/n/b.md' })]));
    expect(getTabs()).toHaveLength(1);
    expect(getTabs()[0].filePath).toBeNull();
  });
});

describe('closeTab', () => {
  it('keeps the latest text on the closed tab, for a write still queued for it', async () => {
    await restore(session([tab({ id: 'a', mode: 'edit', content: 'old' }), tab({ id: 'b', mode: 'edit', content: 'other' })]));
    const closing = getTabs()[0];
    const view = getView()!;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'typed' } });
    await closeTab('a');
    expect(getTabs().map((t) => t.id)).toEqual(['b']);
    expect(textOf(closing)).toBe('typed');
  });

  it('keeps an empty untitled tab while a screenshot is still saving into it, so the link lands and Restore brings it back', async () => {
    await restore(session([tab({ id: 'e', mode: 'edit' }), tab({ id: 'f', mode: 'edit', content: 'other' })]));
    let land!: () => void;
    void trackImageSave('e', new Promise<void>((r) => (land = r)));
    expect(await closeTab('e')).toBeDefined();
    applyToTab('e', { changes: { from: 0, insert: '![snip](untitled.assets/a.png)\n' } });
    land();
    expect(snapshot().closedTabs.find((c) => c.tab.id === 'e')?.tab.content).toBe('![snip](untitled.assets/a.png)\n');
  });

  it('a tab restored in read mode has a document, so a drop or reload lands in it', async () => {
    await restore(session([tab({ id: 'read-r', mode: 'read', content: 'text' })]));
    expect(applyToTab('read-r', { changes: { from: 4, insert: '\n![snip](x.png)' } })).toBe(true);
    expect(textOf(getTabs()[0])).toBe('text\n![snip](x.png)');
  });

  it('drops an empty untitled tab with nothing saving', async () => {
    await restore(session([tab({ id: 'empty-g', mode: 'edit' }), tab({ id: 'empty-h', mode: 'edit', content: 'x' })]));
    expect(await closeTab('empty-g')).toBeUndefined();
  });
});

describe('closed-tabs list', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it('keeps a closed tab with its text, newest first, and reopens it with the same id', async () => {
    await restore(session([tab({ id: 'ca', content: 'one' }), tab({ id: 'cb', content: 'two' }), tab({ id: 'cc' })]));
    await closeTab('ca');
    await closeTab('cb');
    expect(snapshot().closedTabs.map((c) => [c.tab.id, c.tab.content])).toEqual([['cb', 'two'], ['ca', 'one']]);
    const back = await reopenClosed();
    expect(back?.id).toBe('cb');
    expect(textOf(back!)).toBe('two');
    expect(getTabs().map((t) => t.id)).toEqual(['cc', 'cb']);
    expect(getActiveTab()?.id).toBe('cb');
    await reopenClosed('ca');
    expect(snapshot().closedTabs).toEqual([]);
  });

  it('keeps at most 20 entries and none older than 14 days, also from the session', async () => {
    const old = { tab: tab({ id: 'old' }), closedAt: Date.now() - 15 * DAY };
    const fresh = { tab: tab({ id: 'fresh' }), closedAt: Date.now() - DAY };
    await restore({ ...session([tab({ id: 'k' })]), closedTabs: [old, fresh] });
    expect(snapshot().closedTabs.map((c) => c.tab.id)).toEqual(['fresh']);
    const many = Array.from({ length: 21 }, (_, i) => tab({ id: `t${i}`, content: 'x' }));
    await restore(session([...many, tab({ id: 'keep' })]));
    for (const t of many) await closeTab(t.id);
    const ids = snapshot().closedTabs.map((c) => c.tab.id);
    expect(ids).toHaveLength(20);
    expect(ids[0]).toBe('t20');
  });

  it('a write that ends after the close marks the closed entry saved', async () => {
    await restore(session([tab({ id: 'd', filePath: 'C:/n/d.md', dirty: true, content: 'mine' }), tab({ id: 'e' })]));
    await closeTab('d');
    const stamp = { mtimeMs: 5, size: 4 };
    markSaved('d', { text: 'mine', stamp });
    const entry = snapshot().closedTabs[0].tab;
    expect(entry.dirty).toBe(false);
    expect(entry.disk).toEqual(stamp);
  });

  it('reads a clean disk tab again on reopen; when the read fails it stays closed and its text opens as a read copy', async () => {
    vi.mocked(readNote).mockResolvedValue(note('v1'));
    await restore(session([tab({ id: 'c', title: 'c.md', filePath: 'C:/n/c.md' }), tab({ id: 'u' })]));
    await closeTab('c');
    vi.mocked(readNote).mockResolvedValueOnce(note('v2'));
    expect(textOf((await reopenClosed())!)).toBe('v2');
    await closeTab('c');
    vi.mocked(readNote).mockRejectedValueOnce(new Error('gone'));
    expect(await reopenClosed()).toBeUndefined();
    expect(snapshot().closedTabs.map((c) => c.tab.id)).toContain('c');
    const copy = getTabs().find((t) => t.title === 'c.md (closed)');
    expect(copy && textOf(copy)).toBe('v2');
    expect(copy?.filePath).toBeNull();
  });

  it('activates a note that is open again instead of a second tab, and opens unsaved edits as a read copy', async () => {
    vi.mocked(readNote).mockResolvedValue(note('disk'));
    await restore(session([tab({ id: 'd', title: 'd.md', filePath: 'C:/n/d.md', dirty: true, content: 'mine' }), tab({ id: 'x2', title: 'd.md', filePath: 'C:/n/D.md' })]));
    await closeTab('d');
    expect(await reopenClosed()).toBeUndefined();
    expect(getTabs().filter((t) => t.filePath).map((t) => t.id)).toEqual(['x2']);
    const copy = getTabs().find((t) => t.title === 'd.md (closed)');
    expect(copy?.mode).toBe('read');
    expect(textOf(copy!)).toBe('mine');
  });
});

describe('a closed tab is a tab without a view', () => {
  it('an edit that lands after the close (a paste, a link rewrite) is in the entry and comes back', async () => {
    await restore(session([tab({ id: 'pa', mode: 'edit', content: 'text' }), tab({ id: 'pb', mode: 'edit', content: 'x' })]));
    await closeTab('pa');
    expect(applyToTab('pa', { changes: { from: 4, insert: '\n![snip](untitled.assets/s.png)' } })).toBe(true);
    expect(snapshot().closedTabs[0].tab.content).toBe('text\n![snip](untitled.assets/s.png)');
    expect(textOf((await reopenClosed('pa'))!)).toBe('text\n![snip](untitled.assets/s.png)');
  });

  it('a closed note keeps its path, so a paste still running saves next to the note, not in scratch', async () => {
    await restore(session([tab({ id: 'fp', filePath: 'C:/n/fp.md', content: 'note' }), tab({ id: 'fq', content: 'k' })]));
    await closeTab('fp');
    expect(filePathFor('fp')).toBe('C:/n/fp.md');
  });

  it('keeps unwritten edits past 20 entries; drops the others and their editor state', async () => {
    const dirty = tab({ id: 'dw', filePath: 'C:/n/dw.md', dirty: true, content: 'mine' });
    const many = Array.from({ length: 21 }, (_, i) => tab({ id: `w${i}`, content: 'x' }));
    await restore(session([dirty, ...many, tab({ id: 'wk', content: 'k' })]));
    await closeTab('dw');
    for (const t of many) await closeTab(t.id);
    const ids = snapshot().closedTabs.map((c) => c.tab.id);
    expect(ids).toContain('dw');
    expect(ids).not.toContain('w0');
    expect(getState('w0')).toBeUndefined();
  });

  it('an empty untitled tab is not kept', async () => {
    await restore(session([tab({ id: 'e0' }), tab({ id: 'e1', content: 'k' })]));
    expect(await closeTab('e0')).toBeUndefined();
    expect(snapshot().closedTabs.map((c) => c.tab.id)).not.toContain('e0');
  });

  it('opening a closed note brings the entry back with its id and edits', async () => {
    await restore(session([tab({ id: 'op', title: 'op.md', filePath: 'C:/n/op.md', dirty: true, content: 'unsaved' }), tab({ id: 'oq', content: 'k' })]));
    await closeTab('op');
    await openPath('C:\\n\\op.md');
    const back = getTabs().find((t) => t.id === 'op');
    expect(back && textOf(back)).toBe('unsaved');
    expect(readNote).not.toHaveBeenCalled();
  });

  it('reopening clears the conflict flag so the watch compares again', async () => {
    await restore(session([tab({ id: 'cf', filePath: 'C:/n/cf.md', dirty: true, content: 'm' }), tab({ id: 'cg', content: 'k' })]));
    setConflict('cf', true);
    await closeTab('cf');
    expect(inConflict('cf')).toBe(true);
    await reopenClosed('cf');
    expect(inConflict('cf')).toBe(false);
    expect(clearTabInfo).toHaveBeenCalledWith('cf');
  });
});

describe('loadText', () => {
  it('replaces only the changed middle of a tab with an editor', async () => {
    await restore(session([tab({ id: 'lt-a', mode: 'edit', content: 'hello world' })]));
    const view = getView()!;
    view.dispatch({ selection: { anchor: 11 } });
    loadText(getTabs()[0], 'hello brave world');
    expect(textOf(getTabs()[0])).toBe('hello brave world');
    expect(view.state.selection.main.head).toBe(17); // the cursor moved with the text after it
  });

  it('a restored tab never shown takes the file text, so its next write cannot undo an outside edit', async () => {
    vi.mocked(readNote).mockResolvedValue(note('B original\n'));
    await restore(session([
      tab({ id: 'lt-shown', mode: 'edit', content: 'x' }),
      tab({ id: 'lt-hidden', title: 'b.md', filePath: 'C:/n/b.md' })
    ]));
    const hidden = getTabs()[1];
    expect(getState('lt-hidden')).toBeUndefined();
    loadText(hidden, 'B original\nLINE ADDED OUTSIDE\n');
    expect(textOf(hidden)).toBe('B original\nLINE ADDED OUTSIDE\n');
  });

  it('restoring a closed tab whose file changed shows the new text, even when the hidden view still holds it', async () => {
    vi.mocked(readNote).mockResolvedValue(note('A original\n'));
    await restore(session([
      tab({ id: 'lt-A', title: 'a.md', filePath: 'C:/n/a.md', mode: 'edit' }),
      tab({ id: 'lt-R', mode: 'read', content: 'reading' })
    ]));
    await closeTab('lt-A'); // the next tab is in read mode: the view keeps A's state
    vi.mocked(readNote).mockResolvedValue(note('A original\nADDED OUTSIDE\n'));
    const back = await reopenClosed('lt-A');
    expect(textOf(back!)).toBe('A original\nADDED OUTSIDE\n');
    expect(back!.dirty).toBe(false);
  });
});

describe('a closed tab the hidden view still holds', () => {
  it('keeps a screenshot that lands after the close when another tab is shown', async () => {
    vi.mocked(readNote).mockResolvedValue(note('A\n'));
    await restore(session([
      tab({ id: 'cv-A', title: 'a.md', filePath: 'C:/n/a.md', mode: 'edit' }),
      tab({ id: 'cv-R', mode: 'read', content: 'reading' }),
      tab({ id: 'cv-E', mode: 'edit', content: 'edit' })
    ]));
    await closeTab('cv-A'); // the read-mode neighbour becomes active; the view keeps A
    applyToTab('cv-A', { changes: { from: 2, insert: '![snip](a.assets/s.png)\n' } }); // the save lands late
    const { activate } = await import('./tabs');
    await activate('cv-E');
    expect(getState('cv-A')?.doc.toString()).toBe('A\n![snip](a.assets/s.png)\n');
  });
});

describe('read mode', () => {
  it('a note the renderer throws on goes back to writing with an error, so a restore still finishes', async () => {
    vi.mocked(renderRead).mockRejectedValueOnce(new RangeError('Maximum call stack size exceeded'));
    await restore(session([tab({ id: 'rm-deep', title: 'deep.md', mode: 'read', content: '>'.repeat(3000) })]));
    expect(getActiveTab()?.mode).toBe('edit');
    expect(document.getElementById('r')!.hidden).toBe(true);
    expect(showError).toHaveBeenCalledWith('show deep.md in read mode', expect.any(RangeError));
  });

  it('a slow render of one tab does not land in the read pane of the tab the user went to', async () => {
    await restore(session([tab({ id: 'rm-a', content: 'A' }), tab({ id: 'rm-b', content: 'B' })], 'rm-b'));
    let release!: () => void;
    const slow = document.createElement('article');
    slow.textContent = 'note A';
    vi.mocked(renderRead).mockReturnValueOnce(new Promise((r) => (release = () => r(slow))));
    const goingToA = activate('rm-a');
    await vi.waitFor(() => expect(renderRead).toHaveBeenLastCalledWith('rm-a', 'A', parseSettings(undefined))); // A is rendering
    await activate('rm-b');
    release();
    await goingToA;
    expect(getActiveTab()?.id).toBe('rm-b');
    expect(document.getElementById('r')!.textContent).toBe('B');
  });

  it('an older render of the same tab does not replace a newer one', async () => {
    await restore(session([tab({ id: 'rm-s', content: 'old' })]));
    let release!: () => void;
    const stale = Object.assign(document.createElement('article'), { textContent: 'old' });
    vi.mocked(renderRead).mockReturnValueOnce(new Promise((r) => (release = () => r(stale))));
    const first = activate('rm-s');
    await vi.waitFor(() => expect(renderRead).toHaveBeenLastCalledWith('rm-s', 'old', parseSettings(undefined)));
    applyToTab('rm-s', { changes: { from: 0, insert: 'NEW ' } });
    await activate('rm-s');
    release();
    await first;
    expect(document.getElementById('r')!.textContent).toMatch(/^NEW old/);
  });
});


describe('the session and the tab strip follow every change', () => {
  it('a close, a new tab, a reopen, a save and a gone file write the session at once; an edit is debounced', async () => {
    await restore(session([tab({ id: 'sw-a', mode: 'edit', content: 'a' }), tab({ id: 'sw-b', filePath: 'C:/n/b.md', dirty: true, content: 'b' })]));
    vi.mocked(scheduleSessionSave).mockClear();
    const debounced = () => expect(vi.mocked(scheduleSessionSave).mock.calls.at(-1)?.[0]).toBeUndefined();
    applyToTab('sw-a', { changes: { from: 1, insert: '!' } });
    expect(onEdit).toHaveBeenCalledWith('sw-a');
    expect(scheduleSessionSave).toHaveBeenCalledTimes(1);
    debounced();
    expect(getTab('sw-a')?.dirty).toBe(true);
    applyToTab('sw-a', { changes: { from: 2, insert: '?' } }); // already dirty: still written, still debounced
    expect(onEdit).toHaveBeenCalledTimes(2);
    expect(scheduleSessionSave).toHaveBeenCalledTimes(2);
    debounced();

    for (const [what, run] of [
      ['close', () => closeTab('sw-a')],
      ['new', () => newUntitled()],
      ['reopen', () => reopenClosed('sw-a')],
      ['save', () => Promise.resolve(markSaved('sw-b', { text: 'b', stamp: { mtimeMs: 1, size: 1 } }))],
      ['gone', () => Promise.resolve(markDirty('sw-b'))],
      ['copy', () => openCopy('x (disk)', 'x')]
    ] as const) {
      vi.mocked(scheduleSessionSave).mockClear();
      await run();
      expect(scheduleSessionSave, what).toHaveBeenCalledWith({ immediate: true });
    }
    vi.mocked(scheduleSessionSave).mockClear();
    markDirty('sw-b'); // already dirty: nothing changed
    expect(scheduleSessionSave).not.toHaveBeenCalled();
    await activate('sw-b'); // the active tab is session state too
    expect(scheduleSessionSave).toHaveBeenCalledTimes(1);
    debounced();
  });

  it('redraws the strip with the open tabs and the active one', async () => {
    await restore(session([tab({ id: 'st-a', content: 'a' }), tab({ id: 'st-b', content: 'b' })], 'st-b'));
    render.mockClear();
    await closeTab('st-b');
    const [tabs, active] = render.mock.calls.at(-1)!;
    expect(tabs.map((t: TabState) => t.id)).toEqual(['st-a']);
    expect(active).toBe('st-a');
  });
});

describe('tab order', () => {
  const ids = () => getTabs().map((t) => t.id);

  it('moves a tab left or right among the open tabs and writes the session at once', async () => {
    await restore(session([tab({ id: 'm-a', content: 'a' }), tab({ id: 'm-b', content: 'b' }), tab({ id: 'm-c', content: 'c' })]));
    vi.mocked(scheduleSessionSave).mockClear();
    moveTab('m-c', 0);
    expect(ids()).toEqual(['m-c', 'm-a', 'm-b']);
    expect(scheduleSessionSave).toHaveBeenCalledWith({ immediate: true });
    moveTab('m-c', 2);
    expect(ids()).toEqual(['m-a', 'm-b', 'm-c']);
    expect(snapshot().tabs.map((t) => t.id)).toEqual(['m-a', 'm-b', 'm-c']);
  });

  it('keeps closed tabs out of the count and clamps the target', async () => {
    await restore(session([tab({ id: 'k-a', content: 'a' }), tab({ id: 'k-b', content: 'b' }), tab({ id: 'k-c', content: 'c' })]));
    await closeTab('k-b');
    moveTab('k-a', 9);
    expect(ids()).toEqual(['k-c', 'k-a']);
    moveTab('k-b', 0); // closed: not moved
    expect(ids()).toEqual(['k-c', 'k-a']);
  });

  it('moves the active tab one place and stops at either end', async () => {
    await restore(session([tab({ id: 'e-a', content: 'a' }), tab({ id: 'e-b', content: 'b' })], 'e-a'));
    moveActive(-1);
    expect(ids()).toEqual(['e-a', 'e-b']);
    moveActive(1);
    expect(ids()).toEqual(['e-b', 'e-a']);
    moveActive(1);
    expect(ids()).toEqual(['e-b', 'e-a']);
  });
});

describe('settings in the session and read mode', () => {
  it('the snapshot carries the toggles', async () => {
    await restore(session([tab({ id: 's-a', content: 'a' })]));
    expect(snapshot().settings).toEqual(parseSettings(undefined));
  });

  it('refreshRead renders the active read tab again with the current toggles, and leaves a writing tab alone', async () => {
    await restore(session([tab({ id: 'rr-a', content: 'a', mode: 'read' })]));
    vi.mocked(renderRead).mockClear();
    await refreshRead();
    expect(renderRead).toHaveBeenCalledWith('rr-a', 'a', parseSettings(undefined));
    await toggleMode();
    vi.mocked(renderRead).mockClear();
    await refreshRead();
    expect(renderRead).not.toHaveBeenCalled();
  });

  it('a read-mode render leaves the focus in an info bar, so the command menu stays in use', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
    document.body.insertAdjacentHTML('beforeend', '<div class="infobar-host"><input id="menu-field"></div>');
    const field = document.getElementById('menu-field') as HTMLInputElement;
    pane('r').tabIndex = -1; // as in the app, so the pane can take focus
    await restore(session([tab({ id: 'rf-a', content: 'a', mode: 'read' })]));
    field.focus();
    await refreshRead();
    frames.forEach((f) => f(0));
    expect(document.activeElement).toBe(field);
  });
});

describe('open, closed and the active tab', () => {
  it('openTab sees only open tabs, getTab both', async () => {
    await restore(session([tab({ id: 'oc-a', content: 'a' }), tab({ id: 'oc-b', content: 'b' })]));
    await closeTab('oc-a');
    expect(openTab('oc-a')).toBeUndefined();
    expect(getTab('oc-a')?.id).toBe('oc-a');
    expect(openTab('oc-b')?.id).toBe('oc-b');
    expect(openTab('nope')).toBeUndefined();
  });

  it('closing the active tab shows its right neighbour, or the last tab', async () => {
    await restore(session([tab({ id: 'n-a', content: 'a' }), tab({ id: 'n-b', content: 'b' }), tab({ id: 'n-c', content: 'c' })], 'n-b'));
    await closeTab('n-b');
    expect(getActiveTab()?.id).toBe('n-c');
    await closeTab('n-c');
    expect(getActiveTab()?.id).toBe('n-a');
    await activate('n-a');
    await closeTab('n-a');
    expect(getTabs()).toHaveLength(1);
    expect(getTabs()[0].filePath).toBeNull(); // the last tab closed: a new untitled one
    expect(getActiveTab()?.id).toBe(getTabs()[0].id);
  });

  it('closing a tab that is not active keeps the active one', async () => {
    await restore(session([tab({ id: 'k-a', content: 'a' }), tab({ id: 'k-b', content: 'b' })], 'k-b'));
    await closeTab('k-a');
    expect(getActiveTab()?.id).toBe('k-b');
  });

  it('an empty untitled tab that closes is gone with its editor state', async () => {
    await restore(session([tab({ id: 'eg', mode: 'edit' }), tab({ id: 'eh', mode: 'edit', content: 'x' })]));
    expect(await closeTab('eg')).toBeUndefined();
    expect(getTabs().map((t) => t.id)).toEqual(['eh']);
    expect(getTab('eg')).toBeUndefined();
    expect(getState('eg')).toBeUndefined();
  });

  it('an empty note on disk is kept when closed, so it can be restored', async () => {
    vi.mocked(readNote).mockResolvedValue(note(''));
    await restore(session([tab({ id: 'en', title: 'en.md', filePath: 'C:/n/en.md' }), tab({ id: 'eo', content: 'x' })]));
    expect((await closeTab('en'))?.id).toBe('en');
    expect(snapshot().closedTabs.map((c) => c.tab.id)).toEqual(['en']);
  });

  it('two closes in the same millisecond keep their order', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(2026, 9, 22, 10, 0, 0));
      await restore(session([tab({ id: 'ms-a', content: 'a' }), tab({ id: 'ms-b', content: 'b' }), tab({ id: 'ms-c', content: 'c' })]));
      await closeTab('ms-a');
      await closeTab('ms-b');
      expect(snapshot().closedTabs.map((c) => c.tab.id)).toEqual(['ms-b', 'ms-a']);
      expect((await reopenClosed())?.id).toBe('ms-b');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reopens the closed tab asked for by id, not the most recent one', async () => {
    await restore(session([tab({ id: 'id-a', content: 'a' }), tab({ id: 'id-b', content: 'b' }), tab({ id: 'id-c', content: 'c' })]));
    await closeTab('id-a');
    await closeTab('id-b');
    expect((await reopenClosed('id-a'))?.id).toBe('id-a');
    expect(getTabs().map((t) => t.id)).toEqual(['id-c', 'id-a']);
    expect(await reopenClosed('id-a')).toBeUndefined(); // open already
    expect(await reopenClosed('nope')).toBeUndefined();
  });

  it('a clean closed copy of a note that is open again just activates it', async () => {
    vi.mocked(readNote).mockResolvedValue(note('disk'));
    await restore(session([tab({ id: 'cc', title: 'd.md', filePath: 'C:/n/d.md' }), tab({ id: 'cu', content: 'k' })]));
    await closeTab('cc');
    await openPath('C:/n/D.md'); // the closed note comes back as itself
    expect(getTabs().map((t) => t.id)).toEqual(['cu', 'cc']);
    await activate('cu');
    await closeTab('cc');
    vi.mocked(readNote).mockResolvedValue(note('disk v2')); // the file changed: a clean copy has nothing to keep
    await addTabForPath('C:/n/d.md');
    const again = getTabs().find((t) => t.filePath === 'C:/n/d.md' && t.id !== 'cc')!;
    expect(await reopenClosed('cc')).toBeUndefined();
    expect(getActiveTab()?.id).toBe(again.id);
    expect(getTabs().filter((t) => t.title.endsWith('(closed)'))).toEqual([]);
    expect(snapshot().closedTabs).toEqual([]);
  });
});

/** Opens a note in a new tab even when a closed tab holds it (as a drop of the file would, after the closed one was pruned). */
async function addTabForPath(path: string): Promise<void> {
  const closed = snapshot().closedTabs.map((c) => c.tab.id);
  for (const id of closed) {
    const t = getTab(id)!;
    t.filePath = null; // keep the entry, but off this path, so openPath reads the file
  }
  await openPath(path);
  for (const id of closed) getTab(id)!.filePath = path;
}

describe('opening notes', () => {
  it('a note already open is activated, however its path is spelled', async () => {
    vi.mocked(readNote).mockResolvedValue(note('t'));
    await restore(session([tab({ id: 'op-a', content: 'a' }), tab({ id: 'op-n', title: 'n.md', filePath: 'C:/n/n.md' })]));
    vi.mocked(readNote).mockClear();
    await openPath('c:\\N\\n.md');
    expect(getActiveTab()?.id).toBe('op-n');
    expect(readNote).not.toHaveBeenCalled();
    expect(getTabs()).toHaveLength(2);
  });

  it('a new note is read and opened after the active tab list, with its stamp and format', async () => {
    await restore(session([tab({ id: 'nn-a', content: 'a' })]));
    vi.mocked(readNote).mockResolvedValue({ text: 'new', format: { crlf: false, bom: true }, stamp: { mtimeMs: 7, size: 3 } });
    await openPath('C:\\n\\new.md');
    expect(readNote).toHaveBeenCalledWith('C:/n/new.md');
    const t = getActiveTab()!;
    expect(t).toMatchObject({ title: 'new.md', filePath: 'C:/n/new.md', dirty: false, mode: 'edit', disk: { mtimeMs: 7, size: 3 }, format: { crlf: false, bom: true } });
    expect(textOf(t)).toBe('new');
    expect(getTabs().map((x) => x.id)).toEqual(['nn-a', t.id]);
  });

  it('a note that cannot be read opens nothing and is reported by name', async () => {
    await restore(session([tab({ id: 'nr-a', content: 'a' })]));
    vi.mocked(readNote).mockRejectedValue(new Error('locked'));
    await openPath('C:/n/locked.md');
    expect(getTabs()).toHaveLength(1);
    expect(showError).toHaveBeenCalledWith('open locked.md', new Error('locked'));
  });

  it('several paths open in order', async () => {
    await restore(session([tab({ id: 'sp-a', content: 'a' })]));
    vi.mocked(readNote).mockImplementation(async (p: string) => note(p));
    await openPaths(['C:/n/1.md', 'C:/n/2.md']);
    expect(getTabs().map((t) => t.title)).toEqual(['x', '1.md', '2.md']);
    expect(getActiveTab()?.title).toBe('2.md');
  });

  it('new untitled tabs take the lowest free number, writing, clean', async () => {
    await restore(session([tab({ id: 'u-a', title: 'Untitled-2', content: 'a' })]));
    await newUntitled();
    await newUntitled();
    expect(getTabs().slice(1).map((t) => [t.title, t.mode, t.dirty, t.filePath, textOf(t)])).toEqual([['Untitled-1', 'edit', false, null, ''], ['Untitled-3', 'edit', false, null, '']]);
    expect(getActiveTab()?.title).toBe('Untitled-3');
  });

  it('a closed untitled tab keeps its number; once it is gone the number is free again', async () => {
    const closed = { tab: tab({ id: 'u-c', title: 'Untitled-1', content: 'kept' }), closedAt: Date.now() };
    await restore({ ...session([tab({ id: 'u-o', content: 'a' })]), closedTabs: [closed] });
    await newUntitled();
    expect(getActiveTab()?.title).toBe('Untitled-2');
    await restore(session([tab({ id: 'u-o2', title: 'Untitled-54', content: 'a' })]));
    await newUntitled();
    expect(getActiveTab()?.title).toBe('Untitled-1');
  });

  it('a copy opens next to its tab, in read mode', async () => {
    await restore(session([tab({ id: 'cp-a', content: 'a' }), tab({ id: 'cp-b', content: 'b' })]));
    await openCopy('a.md (disk)', 'disk text', 'cp-b');
    expect(getTabs().map((t) => t.title)).toEqual(['x', 'x', 'a.md (disk)']);
    const copy = getTabs()[2];
    expect(copy).toMatchObject({ mode: 'read', filePath: null, dirty: false });
    expect(textOf(copy)).toBe('disk text');
    expect(getActiveTab()?.id).toBe(copy.id);
    await openCopy('loose', 'l'); // without a neighbour: at the end
    expect(getTabs().at(-1)?.title).toBe('loose');
  });

  it('remembers the last folder', () => {
    setLastFolder('C:/n/sub');
    expect(getLastFolder()).toBe('C:/n/sub');
  });
});

describe('loadText', () => {
  it('a deletion in the middle, an insertion at the end and a cursor before the change are handled minimally', async () => {
    await restore(session([tab({ id: 'ld', mode: 'edit', content: 'one two three' })]));
    const view = getView()!;
    view.dispatch({ selection: { anchor: 2 } });
    loadText(getTabs()[0], 'one three');
    expect(textOf(getTabs()[0])).toBe('one three');
    expect(view.state.selection.main.head).toBe(2); // the cursor sits in the unchanged start
    loadText(getTabs()[0], 'one three four');
    expect(textOf(getTabs()[0])).toBe('one three four');
    expect(view.state.selection.main.head).toBe(2);
    loadText(getTabs()[0], 'one three four');
    expect(textOf(getTabs()[0])).toBe('one three four');
    view.dispatch({ selection: { anchor: 12 } }); // in "four", after the change
    loadText(getTabs()[0], 'one 3 four');
    expect(textOf(getTabs()[0])).toBe('one 3 four');
    expect(view.state.selection.main.head).toBe(8); // moved with the unchanged end
    loadText(getTabs()[0], '');
    expect(textOf(getTabs()[0])).toBe('');
  });
});

describe('cursor, modes and cycling', () => {
  it('a tab keeps its cursor while another tab is shown', async () => {
    await restore(session([tab({ id: 'cu-a', mode: 'edit', content: 'abcdef' }), tab({ id: 'cu-b', mode: 'edit', content: 'x' })]));
    getView()!.dispatch({ selection: { anchor: 4 } });
    expect(snapshot().tabs[0].cursor).toBe(4); // a session write sees it without a tab switch
    await activate('cu-b');
    expect(getTab('cu-a')?.cursor).toBe(4);
    expect(snapshot().tabs[0].cursor).toBe(4);
    await activate('cu-a');
    expect(getView()!.state.selection.main.head).toBe(4);
  });

  it('Ctrl+E toggles between writing and reading', async () => {
    await restore(session([tab({ id: 'tm', mode: 'edit', content: 'text' })]));
    await toggleMode();
    expect(getActiveTab()?.mode).toBe('read');
    expect([pane('e').hidden, pane('r').hidden]).toEqual([true, false]);
    expect(pane('r').textContent).toBe('text');
    await toggleMode();
    expect(getActiveTab()?.mode).toBe('edit');
    expect([pane('e').hidden, pane('r').hidden]).toEqual([false, true]);
  });

  it('Ctrl+Tab cycles forward and back with wrap-around, and does nothing with one tab', async () => {
    await restore(session([tab({ id: 'cy-a', content: 'a' }), tab({ id: 'cy-b', content: 'b' }), tab({ id: 'cy-c', content: 'c' })], 'cy-c'));
    await cycle(1);
    expect(getActiveTab()?.id).toBe('cy-a');
    await cycle(-1);
    expect(getActiveTab()?.id).toBe('cy-c');
    await cycle(-1);
    expect(getActiveTab()?.id).toBe('cy-b');
    await restore(session([tab({ id: 'cy-one', content: 'a' })]));
    await cycle(1);
    expect(getActiveTab()?.id).toBe('cy-one');
  });
});

describe('markSaved and markDirty', () => {
  it('a tab edited during the write stays dirty; the stamp is stored either way', async () => {
    await restore(session([tab({ id: 'ms', filePath: 'C:/n/ms.md', dirty: true, content: 'v1', mode: 'edit' }), tab({ id: 'mt', content: 'k' })]));
    const stamp = { mtimeMs: 3, size: 2 };
    applyToTab('ms', { changes: { from: 2, insert: '!' } });
    markSaved('ms', { text: 'v1', stamp });
    expect(getTab('ms')).toMatchObject({ dirty: true, disk: stamp });
    markSaved('ms', { text: 'v1!', stamp: { mtimeMs: 4, size: 3 } });
    expect(getTab('ms')).toMatchObject({ dirty: false, disk: { mtimeMs: 4, size: 3 } });
    markSaved('nope', { text: '', stamp });
  });

  it('a first save gives the tab its path and title', async () => {
    await restore(session([tab({ id: 'fs', title: 'Untitled-1', dirty: true, content: 'draft' })]));
    markSaved('fs', { text: 'draft', stamp: { mtimeMs: 1, size: 5 }, path: 'C:\\n\\draft.md' });
    expect(getTab('fs')).toMatchObject({ filePath: 'C:/n/draft.md', title: 'draft.md', dirty: false });
    expect(filePathFor('fs')).toBe('C:/n/draft.md');
  });

  it('markDirty keeps the text in the session for a note that is gone', async () => {
    await restore(session([tab({ id: 'md', filePath: 'C:/n/md.md', content: 'kept' })]));
    expect(snapshot().tabs[0].content).toBe('');
    markDirty('md');
    expect(getTab('md')?.dirty).toBe(true);
    expect(snapshot().tabs[0].content).toBe('kept');
  });
});
