import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InfoMessage } from './types';

const m = vi.hoisted(() => ({
  tabs: [] as any[],
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
  reopenClosed: m.reopenClosed
}));
vi.mock('./saving', () => ({ saveTab: m.saveTab }));
vi.mock('./external', () => ({ resolveConflict: m.resolveConflict }));
vi.mock('./diskState', () => ({ inConflict: (id: string) => m.conflicts.has(id) }));
vi.mock('./infobar', () => ({ showInfo: m.showInfo, clearInfo: m.clearInfo, clearTabInfo: m.clearTabInfo }));

import { closeTabWithRestore, restoreClosedTab } from './closedTabs';

function addTab(id: string, o: Record<string, unknown> = {}, content = '') {
  const tab = { id, title: `${id}.md`, filePath: `C:/n/${id}.md`, dirty: false, content, ...o };
  m.tabs.push(tab);
  return tab;
}
const bar = (): InfoMessage => m.showInfo.mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  m.tabs.length = 0;
  m.conflicts.clear();
  m.closeTab.mockImplementation(async (id: string) => m.tabs.find((t) => t.id === id));
});

describe('closeTabWithRestore saving', () => {
  it('saves a dirty disk tab before closing it', async () => {
    addTab('a', { dirty: true });
    await closeTabWithRestore('a');
    expect(m.saveTab).toHaveBeenCalledWith('a');
    expect(m.saveTab.mock.invocationCallOrder[0]).toBeLessThan(m.closeTab.mock.invocationCallOrder[0]);
  });

  it('does not save a clean tab or an untitled one', async () => {
    addTab('a');
    addTab('u', { dirty: true, filePath: null });
    await closeTabWithRestore('a');
    await closeTabWithRestore('u');
    expect(m.saveTab).not.toHaveBeenCalled();
    expect(m.closeTab).toHaveBeenCalledTimes(2);
  });

  it('does not save a tab in conflict and does not clear its conflict', async () => {
    addTab('a', { dirty: true });
    m.conflicts.add('a');
    await closeTabWithRestore('a');
    expect(m.saveTab).not.toHaveBeenCalled();
    expect(m.resolveConflict).not.toHaveBeenCalled();
    expect(m.closeTab).toHaveBeenCalledWith('a');
  });

  it('does nothing for an unknown tab', async () => {
    await closeTabWithRestore('x');
    expect(m.closeTab).not.toHaveBeenCalled();
    expect(m.showInfo).not.toHaveBeenCalled();
  });

  it('clears the bars of the closed id', async () => {
    addTab('a');
    await closeTabWithRestore('a');
    expect(m.clearTabInfo).toHaveBeenCalledWith('a');
  });
});

describe('restore bar', () => {
  it('says only "closed." without screenshots, with key, position, timeout and kbd', async () => {
    addTab('a', {}, 'plain ![w](https://x.com/a.png) ![abs](/a.png) ![d](C:/a.png)');
    await closeTabWithRestore('a');
    const b = bar();
    expect(b.text).toBe('a.md closed.');
    expect(b.kind).toBe('info');
    expect(b.key).toBe('closed');
    expect(b.position).toBe('bottom');
    expect(b.timeoutMs).toBe(8000);
    expect(b.body!.tagName).toBe('KBD');
    expect(b.body!.textContent).toBe('Ctrl+Shift+T');
    expect(b.actions!.map((x) => x.label)).toEqual(['Restore']);
  });

  it('counts one screenshot', async () => {
    addTab('a', {}, '![x](a.assets/one.png)');
    await closeTabWithRestore('a');
    expect(bar().text).toBe('a.md closed, with 1 screenshot.');
  });

  it('counts distinct relative images once each', async () => {
    addTab('a', {}, '![x](a.assets/1.png) ![y](a.assets/1.png) ![z](a.assets/2.png)\n![w](b/3.png) ![h](http://h/4.png)');
    await closeTabWithRestore('a');
    expect(bar().text).toBe('a.md closed, with 3 screenshots.');
  });

  it('Restore reopens that id, re-arms the watch and clears the bar', async () => {
    addTab('a');
    m.reopenClosed.mockResolvedValue({ id: 'a' });
    await closeTabWithRestore('a');
    bar().actions![0].run();
    await vi.waitFor(() => expect(m.clearInfo).toHaveBeenCalledWith('closed'));
    expect(m.reopenClosed).toHaveBeenCalledWith('a');
    expect(m.resolveConflict).toHaveBeenCalledWith('a');
  });
});

describe('restoreClosedTab', () => {
  it('reopens the newest, resolves its conflict and clears the bar', async () => {
    m.reopenClosed.mockResolvedValue({ id: 'z' });
    await restoreClosedTab();
    expect(m.reopenClosed).toHaveBeenCalledWith(undefined);
    expect(m.resolveConflict).toHaveBeenCalledWith('z');
    expect(m.clearInfo).toHaveBeenCalledWith('closed');
  });

  it('with nothing to reopen still clears the bar and resolves nothing', async () => {
    m.reopenClosed.mockResolvedValue(undefined);
    await restoreClosedTab();
    expect(m.resolveConflict).not.toHaveBeenCalled();
    expect(m.clearInfo).toHaveBeenCalledWith('closed');
  });
});
