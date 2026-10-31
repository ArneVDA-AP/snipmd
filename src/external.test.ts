import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InfoMessage } from './types';

const m = vi.hoisted(() => ({
  statNote: vi.fn(),
  readNote: vi.fn(),
  tabs: [] as any[],
  docs: new Map<string, string>(),
  markSaved: vi.fn(),
  openCopy: vi.fn(),
  saveTab: vi.fn(),
  showInfo: vi.fn(),
  clearInfo: vi.fn(),
  showError: vi.fn()
}));
vi.mock('./ipc', () => ({ statNote: m.statNote, readNote: m.readNote }));
vi.mock('./tabs', () => ({
  getTabs: () => m.tabs,
  openTab: (id: string) => m.tabs.find((t) => t.id === id),
  markSaved: m.markSaved,
  markDirty: (id: string) => void (m.tabs.find((t) => t.id === id).dirty = true),
  openCopy: m.openCopy,
  loadText: (t: any, text: string) => m.docs.set(t.id, text),
  textOf: (t: any) => m.docs.get(t.id)
}));
vi.mock('./infobar', () => ({ showInfo: m.showInfo, clearInfo: m.clearInfo, showError: m.showError }));

import { checkTabs, handleRefusedWrite, startExternalWatch } from './external';
import { beginWrite, endWrite, inConflict, setConflict } from './diskState';

const S1 = { mtimeMs: 1, size: 10 };
const S2 = { mtimeMs: 2, size: 12 };
const fmt = { crlf: true, bom: false };

function addTab(id: string, dirty = false, text = 'hello world') {
  const tab = { id, title: `${id}.md`, filePath: `C:/n/${id}.md`, dirty, disk: S1, format: null };
  m.tabs.push(tab);
  m.docs.set(id, text);
  return tab;
}
const lastBar = (): InfoMessage => m.showInfo.mock.calls.at(-1)![0];
const action = (label: string) => lastBar().actions!.find((a) => a.label === label)!;
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  m.tabs.length = 0;
  m.docs.clear();
  m.statNote.mockResolvedValue(S1);
  m.readNote.mockResolvedValue({ text: 'hello brave world', format: fmt, stamp: S2 });
  ['a', 'b'].forEach((id) => setConflict(id, false)); // diskState is shared across tests
});

// Binds the save the conflict choices use; nothing else of the watch is exercised here.
startExternalWatch(m.saveTab);

describe('checkTabs', () => {
  it('does nothing for the same stamp', async () => {
    addTab('a');
    await checkTabs();
    expect(m.readNote).not.toHaveBeenCalled();
    expect(m.showInfo).not.toHaveBeenCalled();
    expect(m.markSaved).not.toHaveBeenCalled();
  });

  it('reloads a changed clean tab and marks it saved', async () => {
    const tab = addTab('a');
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    expect(m.docs.get('a')).toBe('hello brave world');
    expect(m.markSaved).toHaveBeenCalledWith('a', { text: 'hello brave world', stamp: S2 });
    expect(tab.format).toEqual(fmt);
  });

  it('puts a changed dirty tab in conflict with one keyed bar and three actions, once', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    expect(inConflict('a')).toBe(true);
    expect(m.showInfo).toHaveBeenCalledTimes(1);
    expect(lastBar().key).toBe('external:a');
    expect(lastBar().text).toBe('a.md was changed outside SnipMD and you have changes too.');
    expect(lastBar().actions!.map((x) => x.label)).toEqual(['Open disk version', 'Reload', 'Keep mine']);
    m.statNote.mockClear();
    await checkTabs();
    expect(m.statNote).not.toHaveBeenCalled();
    expect(m.showInfo).toHaveBeenCalledTimes(1);
    setConflict('a', false);
  });

  it('Reload replaces the text, marks saved and ends the conflict', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    action('Reload').run();
    await flush();
    expect(m.docs.get('a')).toBe('hello brave world');
    expect(m.markSaved).toHaveBeenCalledWith('a', { text: 'hello brave world', stamp: S2 });
    expect(inConflict('a')).toBe(false);
    expect(m.clearInfo).toHaveBeenCalledWith('external:a');
  });

  it('Keep mine takes the new stamp, ends the conflict and saves', async () => {
    const tab = addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    action('Keep mine').run();
    expect(tab.disk).toEqual(S2);
    expect(inConflict('a')).toBe(false);
    expect(m.saveTab).toHaveBeenCalledWith('a');
    expect(m.docs.get('a')).toBe('hello world');
  });

  it('Open disk version opens a read copy and keeps the bar', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    action('Open disk version').run();
    await flush();
    expect(m.openCopy).toHaveBeenCalledWith('a.md (disk)', 'hello brave world', 'a');
    expect(m.showInfo).toHaveBeenCalledTimes(1); // the action keeps its bar open
    expect(lastBar().actions!.every((a) => a.keepOpen)).toBe(true);
    expect(lastBar().key).toBe('external:a');
    expect(inConflict('a')).toBe(true);
    setConflict('a', false);
  });

  it('skips a tab being written', async () => {
    addTab('a');
    m.statNote.mockResolvedValue(S2);
    beginWrite('a');
    await checkTabs();
    endWrite('a');
    expect(m.statNote).not.toHaveBeenCalled();
    expect(m.readNote).not.toHaveBeenCalled();
  });

  it('a missing file makes the tab dirty, sets conflict and offers Save again', async () => {
    const tab = addTab('a');
    m.statNote.mockResolvedValue(null);
    await checkTabs();
    expect(tab.dirty).toBe(true);
    expect(inConflict('a')).toBe(true);
    expect(lastBar().text).toBe('a.md is no longer on disk.');
    expect(lastBar().actions!.map((x) => x.label)).toEqual(['Save again']);
    action('Save again').run();
    expect(inConflict('a')).toBe(false);
    expect(m.saveTab).toHaveBeenCalledWith('a');
  });

  it('Save again expects no file: the write recreates it, but a note that is there again gets the changed bar', async () => {
    const tab = addTab('a');
    m.statNote.mockResolvedValue(null);
    await checkTabs();
    action('Save again').run();
    expect(tab.disk).toBe('absent');
    await checkTabs(); // still gone: what the tab expects, so no bar comes back
    expect(inConflict('a')).toBe(false);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    expect(lastBar().text).toBe('a.md was changed outside SnipMD and you have changes too.');
    setConflict('a', false);
  });

  it('conflict bars cannot be dismissed, and a failed action keeps the bar and reports beside it', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    expect(lastBar().sticky).toBe(true);
    m.readNote.mockRejectedValueOnce('locked');
    action('Reload').run();
    await flush();
    expect(inConflict('a')).toBe(true);
    expect(lastBar().key).toBe('external:a');
    expect(m.showError.mock.calls[0][2]).toBe('external-error:a');
  });

  it('text typed during the reload read wins: the tab goes into conflict instead of being overwritten', async () => {
    const tab = addTab('a');
    m.statNote.mockResolvedValue(S2);
    m.readNote.mockImplementationOnce(async () => {
      tab.dirty = true; // a keystroke while the file is read
      return { text: 'other', format: fmt, stamp: S2 };
    });
    await checkTabs();
    expect(m.docs.get('a')).toBe('hello world');
    expect(m.markSaved).not.toHaveBeenCalled();
    expect(inConflict('a')).toBe(true);
  });

  it('a write that ends during the stat makes the answer stale: no reload, no conflict', async () => {
    // The stat may have seen the file before our own write landed; the next check sees the truth.
    const tab = addTab('a', true);
    let answer!: (s: unknown) => void;
    m.statNote.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const check = checkTabs();
    beginWrite('a');
    endWrite('a');
    answer(S2); // not the stamp the tab knows
    await check;
    expect(inConflict('a')).toBe(false);
    expect(m.showInfo).not.toHaveBeenCalled();
    expect(m.readNote).not.toHaveBeenCalled();
    expect(tab.disk).toEqual(S1);
  });

  it('a write still running when the stat answers, or a conflict raised meanwhile, makes it stale too', async () => {
    addTab('a');
    let answer!: (s: unknown) => void;
    m.statNote.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const check = checkTabs();
    beginWrite('a');
    answer(S2);
    await check;
    endWrite('a');
    expect(m.readNote).not.toHaveBeenCalled();
    m.statNote.mockReturnValueOnce(new Promise((r) => (answer = r)));
    const again = checkTabs();
    setConflict('a', true); // a refused write put the tab in conflict during the stat
    answer(S2);
    await again;
    expect(m.readNote).not.toHaveBeenCalled();
    expect(m.showInfo).not.toHaveBeenCalled();
    setConflict('a', false);
  });

  it('a stamp that differs in only the time or only the size is a change', async () => {
    const tab = addTab('a');
    m.statNote.mockResolvedValue({ mtimeMs: 1, size: 11 });
    await checkTabs();
    expect(m.markSaved).toHaveBeenCalledTimes(1);
    tab.disk = { mtimeMs: 1, size: 11 };
    m.statNote.mockResolvedValue({ mtimeMs: 2, size: 11 });
    await checkTabs();
    expect(m.markSaved).toHaveBeenCalledTimes(2);
  });

  it('skips untitled tabs and disk tabs without a stamp', async () => {
    m.tabs.push({ id: 'u', title: 'Untitled-1', filePath: null, dirty: true, disk: null });
    m.tabs.push({ id: 'n', title: 'n.md', filePath: 'C:/n/n.md', dirty: true, disk: null });
    await checkTabs();
    expect(m.statNote).not.toHaveBeenCalled();
  });

  it('the gone bar cannot be dismissed either, and Save again is its primary choice', async () => {
    addTab('a');
    m.statNote.mockResolvedValue(null);
    await checkTabs();
    expect(lastBar().sticky).toBe(true);
    expect(lastBar().kind).toBe('warning');
    expect(action('Save again').primary).toBe(true);
    expect(action('Save again').keepOpen).toBe(true);
    setConflict('a', false);
  });

  it('Keep mine is the primary choice of the changed bar', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    expect(lastBar().kind).toBe('warning');
    expect(lastBar().actions!.map((a) => a.primary ?? false)).toEqual([false, false, true]);
    setConflict('a', false);
  });

  it('a choice made after the tab closed only takes its bar away', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    m.tabs.length = 0;
    action('Reload').run();
    await flush();
    expect(m.clearInfo).toHaveBeenCalledWith('external:a');
    expect(m.readNote).not.toHaveBeenCalled();
    expect(m.showError).not.toHaveBeenCalled();
    setConflict('a', false);
  });

  it('a successful choice also clears an error left by an earlier failed one', async () => {
    addTab('a', true);
    m.statNote.mockResolvedValue(S2);
    await checkTabs();
    m.readNote.mockRejectedValueOnce('locked');
    action('Reload').run();
    await flush();
    expect(m.showError).toHaveBeenCalledTimes(1);
    action('Reload').run();
    await flush();
    expect(m.clearInfo).toHaveBeenCalledWith('external-error:a');
    expect(inConflict('a')).toBe(false);
  });

  it('a refused write for a tab already in conflict, or a closed one, raises nothing more', async () => {
    addTab('a', true);
    handleRefusedWrite('a', S2);
    await flush();
    expect(m.showInfo).toHaveBeenCalledTimes(1);
    handleRefusedWrite('a', null);
    await flush();
    expect(m.showInfo).toHaveBeenCalledTimes(1);
    expect(lastBar().text).toBe('a.md was changed outside SnipMD and you have changes too.');
    setConflict('a', false);
    m.tabs.length = 0;
    handleRefusedWrite('a', null);
    await flush();
    expect(m.showInfo).toHaveBeenCalledTimes(1);
    expect(inConflict('a')).toBe(false);
  });

  it('a write Rust refused puts a dirty tab in conflict', async () => {
    addTab('a', true);
    handleRefusedWrite('a', S2);
    await flush();
    expect(inConflict('a')).toBe(true);
    expect(lastBar().key).toBe('external:a');
  });

  it('clears the bar when a later check finds equal stamps', async () => {
    addTab('a');
    await checkTabs();
    expect(m.clearInfo).toHaveBeenCalledWith('external:a');
  });

  it('one failing stat does not stop the other tabs', async () => {
    addTab('a');
    addTab('b');
    m.statNote.mockImplementation((p: string) => (p.endsWith('a.md') ? Promise.reject('boom') : Promise.resolve(S2)));
    await expect(checkTabs()).resolves.toBeUndefined();
    expect(m.markSaved).toHaveBeenCalledTimes(1);
    expect(m.markSaved.mock.calls[0][0]).toBe('b');
  });
});

describe('startExternalWatch', () => {
  let focused = true;
  beforeEach(() => {
    vi.useFakeTimers();
    focused = true;
    vi.spyOn(document, 'hasFocus').mockImplementation(() => focused);
    addTab('a');
  });
  afterEach(() => {
    window.dispatchEvent(new Event('blur'));
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('checks on focus and every 2 s while focused, and stops on blur', async () => {
    startExternalWatch(m.saveTab);
    await vi.advanceTimersByTimeAsync(0);
    expect(m.statNote).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(m.statNote).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new Event('blur'));
    focused = false;
    await vi.advanceTimersByTimeAsync(6000);
    expect(m.statNote).toHaveBeenCalledTimes(3);
    focused = true;
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(m.statNote).toHaveBeenCalledTimes(4);
  });

  it('a second focus event does not double the checks', async () => {
    startExternalWatch(m.saveTab);
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    m.statNote.mockClear();
    await vi.advanceTimersByTimeAsync(4000);
    expect(m.statNote).toHaveBeenCalledTimes(2);
  });

  it('without focus at start it checks once and does not poll', async () => {
    focused = false;
    startExternalWatch(m.saveTab);
    await vi.advanceTimersByTimeAsync(0);
    expect(m.statNote).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6000);
    expect(m.statNote).toHaveBeenCalledTimes(1);
  });
});
