import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InfoMessage } from './types';

const m = vi.hoisted(() => ({
  tabs: [] as any[],
  order: [] as string[],
  conflicts: new Set<string>(),
  closeTab: vi.fn(),
  reopenClosed: vi.fn(),
  saveTab: vi.fn(),
  resolveConflict: vi.fn(),
  showInfo: vi.fn(),
  clearInfo: vi.fn(),
  clearTabInfo: vi.fn()
}));
vi.mock('./tabs', () => ({
  getTab: (id: string) => m.tabs.find((t) => t.id === id),
  closeTab: m.closeTab,
  reopenClosed: m.reopenClosed,
  textOf: (t: any) => t.content
}));
vi.mock('./saving', () => ({ saveTab: m.saveTab }));
vi.mock('./external', () => ({ resolveConflict: m.resolveConflict }));
vi.mock('./diskState', () => ({ inConflict: (id: string) => m.conflicts.has(id) }));
vi.mock('./infobar', () => ({ showInfo: m.showInfo, clearInfo: m.clearInfo, clearTabInfo: m.clearTabInfo }));

import { closeTabWithRestore, restoreClosedTab } from './closedTabs';

function addTab(id: string, opts: { dirty?: boolean; filePath?: string | null; content?: string } = {}) {
  const tab = { id, title: `${id}.md`, filePath: `C:/n/${id}.md`, dirty: false, content: '', ...opts };
  m.tabs.push(tab);
  return tab;
}
const bar = (): InfoMessage => m.showInfo.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  m.tabs.length = 0;
  m.order.length = 0;
  m.conflicts.clear();
  m.saveTab.mockImplementation(async (id: string) => void m.order.push(`save:${id}`));
  m.closeTab.mockImplementation(async (id: string) => {
    m.order.push(`close:${id}`);
    const i = m.tabs.findIndex((t) => t.id === id);
    return i === -1 ? undefined : m.tabs.splice(i, 1)[0];
  });
});

describe('closeTabWithRestore', () => {
  it('does nothing without a tab', async () => {
    await closeTabWithRestore('nope');
    expect(m.closeTab).not.toHaveBeenCalled();
    expect(m.showInfo).not.toHaveBeenCalled();
  });

  it('saves a dirty disk tab before it closes', async () => {
    addTab('a', { dirty: true });
    await closeTabWithRestore('a');
    expect(m.order).toEqual(['save:a', 'close:a']);
  });

  it('does not save a clean or an untitled tab', async () => {
    addTab('a');
    addTab('u', { dirty: true, filePath: null });
    await closeTabWithRestore('a');
    await closeTabWithRestore('u');
    expect(m.saveTab).not.toHaveBeenCalled();
    expect(m.order).toEqual(['close:a', 'close:u']);
  });

  it('does not save a tab in conflict and leaves its conflict alone', async () => {
    addTab('a', { dirty: true });
    m.conflicts.add('a');
    await closeTabWithRestore('a');
    expect(m.saveTab).not.toHaveBeenCalled();
    expect(m.resolveConflict).not.toHaveBeenCalled();
    expect(m.conflicts.has('a')).toBe(true);
    expect(m.order).toEqual(['close:a']);
  });

  it('clears the closed tab\'s bars', async () => {
    addTab('a');
    await closeTabWithRestore('a');
    expect(m.clearTabInfo).toHaveBeenCalledWith('a');
  });

  it('shows the restore bar at the bottom for 8 seconds with the shortcut', async () => {
    addTab('a');
    await closeTabWithRestore('a');
    const b = bar();
    expect(b).toMatchObject({ kind: 'info', key: 'closed', position: 'bottom', timeoutMs: 8000, text: 'a.md closed.' });
    expect(b.body!.tagName).toBe('KBD');
    expect(b.body!.textContent).toBe('Ctrl+Shift+T');
    expect(b.actions).toHaveLength(1);
    expect(b.actions![0]).toMatchObject({ label: 'Restore', primary: true });
  });

  it('counts distinct relative screenshots', async () => {
    addTab('one', { content: '![](one.assets/a.png) ![x](one.assets/a.png) ![](https://x.org/b.png)' });
    await closeTabWithRestore('one');
    expect(bar().text).toBe('one.md closed, with 1 screenshot.');

    const three = [
      '![](t.assets/a.png)',
      '![shot](t.assets/b%20c.png "title")',
      '![](<t.assets/d e.png>)',
      '![](t.assets/a.png)',
      '![](/abs/e.png)',
      '![](http://x.org/f.png)',
      '![](C:/n/g.png)',
      '[link](t.assets/h.png)'
    ].join('\n');
    addTab('t', { content: three });
    await closeTabWithRestore('t');
    expect(bar().text).toBe('t.md closed, with 3 screenshots.');
  });
});

describe('restoreClosedTab', () => {
  it('Restore reopens that tab, re-arms its watch and clears the bar', async () => {
    addTab('a');
    await closeTabWithRestore('a');
    m.reopenClosed.mockResolvedValue({ id: 'a' });
    bar().actions![0].run();
    await new Promise((r) => setTimeout(r, 0));
    expect(m.reopenClosed).toHaveBeenCalledWith('a');
    expect(m.resolveConflict).toHaveBeenCalledWith('a');
    expect(m.clearInfo).toHaveBeenCalledWith('closed');
  });

  it('reopens the most recent without an id', async () => {
    m.reopenClosed.mockResolvedValue({ id: 'b' });
    await restoreClosedTab();
    expect(m.reopenClosed).toHaveBeenCalledWith(undefined);
    expect(m.resolveConflict).toHaveBeenCalledWith('b');
    expect(m.clearInfo).toHaveBeenCalledWith('closed');
  });

  it('with nothing to reopen still clears the bar and resolves no conflict', async () => {
    m.reopenClosed.mockResolvedValue(undefined);
    await restoreClosedTab();
    expect(m.resolveConflict).not.toHaveBeenCalled();
    expect(m.clearInfo).toHaveBeenCalledWith('closed');
  });
});
