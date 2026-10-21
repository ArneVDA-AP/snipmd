import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionFile, TabState } from './types';

vi.mock('./ipc', () => ({ readNote: vi.fn(), saveSessionRaw: vi.fn(), loadSessionRaw: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), clearInfo: vi.fn(), clearTabInfo: vi.fn() }));
vi.mock('./preview/render', () => ({ renderRead: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./titlebar', () => ({ Titlebar: class {} }));

import { readNote } from './ipc';
import { clearTabInfo, showError } from './infobar';
import { closeTab, initTabs, loadText, markSaved, openPath, reopenClosed, restore, snapshot, getTabs, textOf } from './tabs';
import { inConflict, setConflict } from './diskState';
import { applyToTab, filePathFor, getState, getView, trackImageSave } from './editor/registry';

const tab = (o: Partial<TabState>): TabState => ({
  id: 'x', title: 'x', filePath: null, content: '', dirty: false, mode: 'read', cursor: 0, scrollTop: 0, disk: null, format: null, ...o
});
const note = (text: string) => ({ text, format: { crlf: true, bom: false }, stamp: { mtimeMs: 1, size: text.length } });
const session = (tabs: TabState[], active = tabs[0]?.id ?? ''): SessionFile => ({
  version: 3, activeTabId: active, untitledCounter: 2, lastFolder: null, tabs, closedTabs: []
});

beforeEach(() => {
  vi.mocked(readNote).mockReset();
  vi.mocked(showError).mockReset();
  document.body.innerHTML = '<div id="e"></div><div id="r"></div>';
  initTabs(
    { editor: document.getElementById('e')!, read: document.getElementById('r')! },
    { render: vi.fn() } as never,
    () => {}
  );
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

  it('drops a tab whose read fails, keeps the others and shows one error', async () => {
    vi.mocked(readNote).mockImplementation(async (p: string) => {
      if (p.includes('bad')) throw new Error('gone');
      return note('ok');
    });
    await restore(session([
      tab({ id: 'b1', title: 'bad1.md', filePath: 'C:/n/bad1.md' }),
      tab({ id: 'g', title: 'g.md', filePath: 'C:/n/g.md' }),
      tab({ id: 'b2', title: 'bad2.md', filePath: 'C:/n/bad2.md' })
    ], 'b1'));
    expect(getTabs().map((t) => t.id)).toEqual(['g']);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showError).mock.calls[0][0]).toBe('reopen bad1.md, bad2.md');
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
