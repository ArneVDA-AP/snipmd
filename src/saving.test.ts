import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  tabs: [] as Array<{ id: string; title: string; filePath: string | null; dirty: boolean; text: string; format?: unknown }>,
  log: [] as string[]
}));

vi.mock('./ipc', () => ({
  pickSavePath: vi.fn(),
  promoteUntitled: vi.fn(),
  writeNote: vi.fn(),
  claimNewNote: vi.fn(),
  copyAssets: vi.fn()
}));
vi.mock('./firstSaveBar', () => ({ askFirstSave: vi.fn() }));
vi.mock('./editor/links', () => ({ rewriteImagePrefix: vi.fn() }));
vi.mock('./tabs', () => ({
  getTab: (id: string) => h.tabs.find((t) => t.id === id),
  getTabs: () => h.tabs,
  textOf: (t: { text: string }) => t.text,
  markSaved: vi.fn((id: string, w: { path?: string }) => {
    const t = h.tabs.find((x) => x.id === id);
    if (t) t.dirty = false;
    if (t && w.path) t.filePath = w.path;
    h.log.push(`markSaved ${w.path ?? ''}`);
  }),
  setLastFolder: vi.fn((f: string) => h.log.push(`lastFolder ${f}`))
}));
vi.mock('./session', () => ({ flushSession: vi.fn(() => Promise.resolve()), scheduleSessionSave: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), clearInfo: vi.fn() }));

import { flushDirty, saveAs, saveTab, scheduleAutosave } from './saving';
import { claimNewNote, copyAssets, pickSavePath, promoteUntitled, writeNote } from './ipc';
import { askFirstSave } from './firstSaveBar';
import { rewriteImagePrefix } from './editor/links';
import { markSaved } from './tabs';
import { setConflict } from './diskState';
import { flushSession } from './session';
import { clearInfo, showError } from './infobar';

const mk = (id: string) => ({ id, title: id, filePath: `/n/${id}.md`, dirty: true, text: `text ${id}` });
const STAMP = { mtimeMs: 1, size: 1 };
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.tabs = [];
  h.log = [];
  vi.useRealTimers();
  ['a', 's1', 's2', 'm1', 'f1', 'f2', 'c', 'u', 'd'].forEach((i) => setConflict(i, false));
  vi.mocked(flushSession).mockImplementation(() => Promise.resolve());
  vi.mocked(writeNote).mockResolvedValue(STAMP);
  vi.mocked(showError).mockReturnValue(() => {});
});

describe('flushDirty', () => {
  it('one rejected write leaves the other tabs saved and the session flushed', async () => {
    h.tabs = [mk('a'), mk('b'), mk('c')];
    vi.mocked(writeNote).mockImplementation(async (p: string) => {
      if (p.includes('/b.')) throw 'disk full';
      return STAMP;
    });
    await expect(flushDirty()).resolves.toBeUndefined();
    expect(h.tabs.map((t) => t.dirty)).toEqual([false, true, false]);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showError).mock.calls[0][0]).toBe('save b');
    expect(flushSession).toHaveBeenCalledTimes(2);
  });

  it('calls flushSession before any note write settles', async () => {
    h.tabs = [mk('a')];
    vi.mocked(writeNote).mockReturnValue(new Promise(() => {}));
    void flushDirty();
    await tick();
    expect(writeNote).toHaveBeenCalled();
    expect(flushSession).toHaveBeenCalledTimes(1);
    const order = [vi.mocked(flushSession).mock.invocationCallOrder[0], vi.mocked(writeNote).mock.invocationCallOrder[0]];
    expect(order[0]).toBeLessThan(order[1]);
  });
});

describe('saveTab', () => {
  it('runs two saves of one tab one after the other, the second with the newer text', async () => {
    h.tabs = [mk('s1')];
    let release!: () => void;
    const log: string[] = [];
    vi.mocked(writeNote).mockImplementation(async (_p: string, text: string) => {
      log.push(`start ${text}`);
      if (log.length === 1) await new Promise<void>((r) => (release = r));
      log.push(`end ${text}`);
      return STAMP;
    });
    const p1 = saveTab('s1');
    await tick();
    h.tabs[0].text = 'newer';
    const p2 = saveTab('s1');
    await tick();
    expect(log).toEqual(['start text s1']);
    release();
    await Promise.all([p1, p2]);
    expect(log).toEqual(['start text s1', 'end text s1', 'start newer', 'end newer']);
  });

  it('clears the tab error after a later success', async () => {
    h.tabs = [mk('s2')];
    vi.mocked(writeNote).mockRejectedValueOnce('locked');
    expect(await saveTab('s2')).toBe(false);
    expect(showError).toHaveBeenCalledWith('save s2', 'locked', 'save:s2');
    expect(clearInfo).not.toHaveBeenCalled();
    expect(await saveTab('s2')).toBe(true);
    expect(clearInfo).toHaveBeenCalledWith('save:s2');
  });

  it('saves asked for during a write merge into one follow-up write with the newest text', async () => {
    const tab = mk('m1');
    h.tabs = [tab];
    let release!: () => void;
    const writes: string[] = [];
    vi.mocked(writeNote).mockImplementation(async (_p: string, text: string) => {
      writes.push(text);
      if (writes.length === 1) await new Promise<void>((r) => (release = r));
      return STAMP;
    });
    tab.text = 'v1';
    const first = saveTab('m1');
    await tick();
    const later = ['v2', 'v3', 'v4'].map((v) => ((tab.text = v), saveTab('m1')));
    release();
    expect(await Promise.all([first, ...later])).toEqual([true, true, true, true]);
    expect(writes).toEqual(['v1', 'v4']);
  });
});

describe('write failures', () => {
  it('each failing tab keeps its own error until that tab saves', async () => {
    h.tabs = [mk('f1'), mk('f2')];
    vi.mocked(writeNote).mockRejectedValue('drive removed');
    await flushDirty();
    expect(vi.mocked(showError).mock.calls.map((c) => c[2])).toEqual(['save:f1', 'save:f2']);
    vi.mocked(writeNote).mockResolvedValue(STAMP);
    await saveTab('f1');
    expect(clearInfo).toHaveBeenCalledWith('save:f1');
    expect(clearInfo).not.toHaveBeenCalledWith('save:f2');
  });
});

const untitled = () => ({ id: 'u', title: 'Untitled-1', filePath: null as string | null, dirty: true, text: 'hello' });

describe('autosave', () => {
  it('writes 1 s after the last edit and not before', async () => {
    vi.useFakeTimers();
    h.tabs = [mk('au')];
    scheduleAutosave('au');
    await vi.advanceTimersByTimeAsync(800);
    scheduleAutosave('au');
    await vi.advanceTimersByTimeAsync(900);
    expect(writeNote).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(150);
    expect(writeNote).toHaveBeenCalledTimes(1);
  });

  it('skips untitled and clean tabs', async () => {
    vi.useFakeTimers();
    h.tabs = [untitled(), { ...mk('cl'), dirty: false }];
    scheduleAutosave('u');
    scheduleAutosave('cl');
    await vi.advanceTimersByTimeAsync(1500);
    expect(writeNote).not.toHaveBeenCalled();
    expect(askFirstSave).not.toHaveBeenCalled();
  });
});

describe('conflict', () => {
  it('saveTab, autosave and flushDirty write nothing for a tab in conflict', async () => {
    vi.useFakeTimers();
    h.tabs = [mk('c')];
    setConflict('c', true);
    expect(await saveTab('c')).toBe(false);
    scheduleAutosave('c');
    await vi.advanceTimersByTimeAsync(1500);
    await flushDirty();
    expect(writeNote).not.toHaveBeenCalled();
    setConflict('c', false);
    expect(await saveTab('c')).toBe(true);
    expect(writeNote).toHaveBeenCalledTimes(1);
  });
});

describe('format and stamp', () => {
  it('writeNote gets the tab format and markSaved the returned stamp', async () => {
    const stamp = { mtimeMs: 9, size: 4 };
    h.tabs = [{ ...mk('fm'), format: { eol: 'crlf' } }];
    vi.mocked(writeNote).mockResolvedValue(stamp);
    await saveTab('fm');
    expect(writeNote).toHaveBeenCalledWith('/n/fm.md', 'text fm', { eol: 'crlf' });
    expect(markSaved).toHaveBeenCalledWith('fm', { text: 'text fm', stamp });
  });
});

describe('first save', () => {
  const MOVE = { from: 'untitled.assets/', to: 'x.assets/' };
  beforeEach(() => {
    h.tabs = [untitled()];
    vi.mocked(promoteUntitled).mockImplementation(async () => (h.log.push('promote'), MOVE));
    vi.mocked(rewriteImagePrefix).mockImplementation(() => (h.log.push('rewrite'), 1));
    vi.mocked(writeNote).mockImplementation(async () => (h.log.push('write'), STAMP));
  });

  it('claims the note, promotes, rewrites, writes, then sets the path and last folder', async () => {
    vi.mocked(askFirstSave).mockResolvedValue({ folder: '/n', name: 'x.md' });
    vi.mocked(claimNewNote).mockImplementation(async () => (h.log.push('claim'), '/n/x.md'));
    expect(await saveTab('u')).toBe(true);
    expect(claimNewNote).toHaveBeenCalledWith('/n', 'x.md');
    expect(promoteUntitled).toHaveBeenCalledWith('u', '/n/x.md');
    expect(rewriteImagePrefix).toHaveBeenCalledWith('u', MOVE);
    expect(writeNote).toHaveBeenCalledWith('/n/x.md', 'hello', null);
    expect(h.log).toEqual(['claim', 'promote', 'rewrite', 'write', 'markSaved /n/x.md', 'lastFolder /n']);
  });

  it('other uses pickSavePath', async () => {
    vi.mocked(askFirstSave).mockResolvedValue('other');
    vi.mocked(pickSavePath).mockResolvedValue('/z/y.md');
    expect(await saveTab('u')).toBe(true);
    expect(claimNewNote).not.toHaveBeenCalled();
    expect(promoteUntitled).toHaveBeenCalledWith('u', '/z/y.md');
  });

  it('null writes nothing', async () => {
    vi.mocked(askFirstSave).mockResolvedValue(null);
    expect(await saveTab('u')).toBe(false);
    expect(promoteUntitled).not.toHaveBeenCalled();
    expect(writeNote).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('a failing promote leaves the tab untitled and shows one error', async () => {
    vi.mocked(askFirstSave).mockResolvedValue({ folder: '/n', name: 'x.md' });
    vi.mocked(claimNewNote).mockResolvedValue('/n/x.md');
    vi.mocked(promoteUntitled).mockRejectedValue('no space');
    expect(await saveTab('u')).toBe(false);
    expect(h.tabs[0].filePath).toBeNull();
    expect(rewriteImagePrefix).not.toHaveBeenCalled();
    expect(writeNote).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showError).mock.calls[0][0]).toContain('Untitled-1');
  });
});

describe('saveAs of a disk tab', () => {
  it('copies assets, rewrites, writes the new path with the old format and never the old path', async () => {
    const MOVE = { from: 'a.assets/', to: 'b.assets/' };
    h.tabs = [{ ...mk('d'), format: { eol: 'crlf' } }];
    vi.mocked(pickSavePath).mockResolvedValue('/m/b.md');
    vi.mocked(copyAssets).mockResolvedValue(MOVE);
    expect(await saveAs('d')).toBe(true);
    expect(copyAssets).toHaveBeenCalledWith('/n/d.md', '/m/b.md');
    expect(rewriteImagePrefix).toHaveBeenCalledWith('d', MOVE);
    expect(writeNote).toHaveBeenCalledTimes(1);
    expect(writeNote).toHaveBeenCalledWith('/m/b.md', 'text d', { eol: 'crlf' });
    expect(markSaved).toHaveBeenCalledWith('d', expect.objectContaining({ path: '/m/b.md' }));
  });

  it('the same path is a plain save without copying', async () => {
    h.tabs = [mk('d')];
    vi.mocked(pickSavePath).mockResolvedValue('/n/d.md');
    expect(await saveAs('d')).toBe(true);
    expect(copyAssets).not.toHaveBeenCalled();
    expect(writeNote).toHaveBeenCalledWith('/n/d.md', 'text d', undefined);
  });
});
