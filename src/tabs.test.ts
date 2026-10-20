import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionFile, TabState } from './types';

vi.mock('./ipc', () => ({ readNote: vi.fn(), gcScratchAssets: vi.fn().mockResolvedValue(0), saveSessionRaw: vi.fn(), loadSessionRaw: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), clearInfo: vi.fn() }));
vi.mock('./preview/render', () => ({ renderRead: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./titlebar', () => ({ Titlebar: class {} }));

import { readNote } from './ipc';
import { showError } from './infobar';
import { closeTab, initTabs, restore, snapshot, getTabs, textOf } from './tabs';
import { getView } from './editor/registry';

const tab = (o: Partial<TabState>): TabState => ({
  id: 'x', title: 'x', filePath: null, content: '', dirty: false, mode: 'read', cursor: 0, scrollTop: 0, ...o
});
const session = (tabs: TabState[], active = tabs[0]?.id ?? ''): SessionFile => ({
  version: 3, activeTabId: active, untitledCounter: 2, lastFolder: null, tabs, closedTabs: []
});

beforeEach(() => {
  vi.mocked(readNote).mockReset();
  vi.mocked(showError).mockReset();
  document.body.innerHTML = '<div id="e"></div><div id="r"></div>';
  initTabs(
    { editor: document.getElementById('e')!, read: document.getElementById('r')! },
    { render: vi.fn() } as never
  );
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

describe('snapshot', () => {
  it('stores no text for a clean disk tab, the text for dirty and untitled tabs, and leaves live tabs alone', async () => {
    vi.mocked(readNote).mockResolvedValue({ text: 'from disk' });
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
    vi.mocked(readNote).mockResolvedValue({ text: 'fresh' });
    await restore(session([tab({ id: 'c', filePath: 'C:/n/c.md', content: 'stale' })]));
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
      return { text: 'ok' };
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
});
