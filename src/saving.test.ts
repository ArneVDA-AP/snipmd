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
vi.mock('./editor/links', () => ({ rewriteImagePrefix: vi.fn(), rewrittenText: vi.fn(() => 'rewritten') }));
vi.mock('./tabs', () => ({
  getTab: (id: string) => h.tabs.find((t) => t.id === id),
  openTab: (id: string) => h.tabs.find((t) => t.id === id),
  allTabs: () => h.tabs,
  textOf: (t: { text: string }) => t.text,
  markSaved: vi.fn((id: string, w: { text: string; path?: string }) => {
    const t = h.tabs.find((x) => x.id === id);
    if (t && t.text === w.text) t.dirty = false; // as tabs.ts: only when the text is still the written one
    if (t && w.path) t.filePath = w.path;
    h.log.push(`markSaved ${w.path ?? ''}`);
  }),
  setLastFolder: vi.fn((f: string) => h.log.push(`lastFolder ${f}`))
}));
vi.mock('./external', () => ({ handleRefusedWrite: vi.fn(), resolveConflict: vi.fn() }));
vi.mock('./session', () => ({ flushSession: vi.fn(() => Promise.resolve()), scheduleSessionSave: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), showInfo: vi.fn(), clearInfo: vi.fn(), errorText: String }));

import { flushDirty, saveAs, saveTab, scheduleAutosave } from './saving';
import { claimNewNote, copyAssets, pickSavePath, promoteUntitled, writeNote } from './ipc';
import { askFirstSave } from './firstSaveBar';
import { rewriteImagePrefix } from './editor/links';
import { markSaved } from './tabs';
import { setConflict } from './diskState';
import { handleRefusedWrite } from './external';
import { trackImageSave } from './editor/registry';
import { flushSession } from './session';
import { clearInfo, showError } from './infobar';

const mk = (id: string) => ({ id, title: id, filePath: `/n/${id}.md`, dirty: true, text: `text ${id}` });
const STAMP = { mtimeMs: 1, size: 1 };
const W = { written: STAMP };
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.tabs = [];
  h.log = [];
  vi.useRealTimers();
  ['a', 's1', 's2', 'm1', 'f1', 'f2', 'c', 'u', 'd'].forEach((i) => setConflict(i, false));
  vi.mocked(flushSession).mockImplementation(() => Promise.resolve());
  vi.mocked(writeNote).mockResolvedValue(W);
  vi.mocked(showError).mockReturnValue(() => {});
});

describe('flushDirty', () => {
  it('waits for a screenshot still saving, then writes the tab its link made dirty', async () => {
    const tab = { ...mk('a'), dirty: false };
    h.tabs = [tab];
    let land!: () => void;
    void trackImageSave('a', new Promise<void>((r) => (land = r)).then(() => (tab.dirty = true)));
    const flushed = flushDirty();
    await tick();
    expect(writeNote).not.toHaveBeenCalled();
    land();
    await flushed;
    expect(writeNote).toHaveBeenCalledTimes(1);
  });

  it('one rejected write leaves the other tabs saved and the session flushed', async () => {
    h.tabs = [mk('a'), mk('b'), mk('c')];
    vi.mocked(writeNote).mockImplementation(async (p: string) => {
      if (p.includes('/b.')) throw 'disk full';
      return W;
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
      return W;
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
      return W;
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
    vi.mocked(writeNote).mockResolvedValue(W);
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
    vi.mocked(writeNote).mockResolvedValue({ written: stamp });
    await saveTab('fm');
    expect(writeNote).toHaveBeenCalledWith('/n/fm.md', 'text fm', { eol: 'crlf' }, undefined);
    expect(markSaved).toHaveBeenCalledWith('fm', { text: 'text fm', stamp });
  });

  it('sends the known stamp; a write Rust refuses is handed to the watch and not marked saved', async () => {
    const known = { mtimeMs: 5, size: 5 };
    const now = { mtimeMs: 6, size: 7 };
    h.tabs = [{ ...mk('rf'), disk: known } as never];
    vi.mocked(writeNote).mockResolvedValue({ changed: now });
    expect(await saveTab('rf')).toBe(false);
    expect(vi.mocked(writeNote).mock.calls[0][3]).toEqual(known);
    expect(markSaved).not.toHaveBeenCalled();
    expect(handleRefusedWrite).toHaveBeenCalledWith('rf', now);
  });
});

describe('first save', () => {
  const MOVE = { from: 'untitled.assets/', to: 'x.assets/' };
  beforeEach(() => {
    h.tabs = [untitled()];
    vi.mocked(promoteUntitled).mockImplementation(async () => (h.log.push('promote'), MOVE));
    vi.mocked(rewriteImagePrefix).mockImplementation(() => (h.log.push('rewrite'), 1));
    vi.mocked(writeNote).mockImplementation(async () => (h.log.push('write'), W));
  });

  it('claims the note and writes it before it moves the images and rewrites the links', async () => {
    vi.mocked(askFirstSave).mockResolvedValue({ folder: '/n', name: 'x.md' });
    vi.mocked(claimNewNote).mockImplementation(async () => (h.log.push('claim'), '/n/x.md'));
    expect(await saveTab('u')).toBe(true);
    expect(claimNewNote).toHaveBeenCalledWith('/n', 'x.md');
    expect(writeNote).toHaveBeenCalledWith('/n/x.md', 'hello', null, null);
    expect(promoteUntitled).toHaveBeenCalledWith('u', '/n/x.md');
    expect(rewriteImagePrefix).toHaveBeenCalledWith('u', MOVE);
    expect(h.log).toEqual(['claim', 'write', 'markSaved /n/x.md', 'lastFolder /n', 'promote', 'rewrite']);
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

  it('a failing write leaves the tab untitled, its images and links untouched', async () => {
    vi.mocked(askFirstSave).mockResolvedValue({ folder: '/n', name: 'x.md' });
    vi.mocked(claimNewNote).mockResolvedValue('/n/x.md');
    vi.mocked(writeNote).mockRejectedValue('disk full');
    expect(await saveTab('u')).toBe(false);
    expect(h.tabs[0].filePath).toBeNull();
    expect(promoteUntitled).not.toHaveBeenCalled();
    expect(rewriteImagePrefix).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showError).mock.calls[0][0]).toContain('Untitled-1');
  });

  it('a failing move keeps the saved note, leaves the links and offers to try again', async () => {
    vi.mocked(askFirstSave).mockResolvedValue({ folder: '/n', name: 'x.md' });
    vi.mocked(claimNewNote).mockResolvedValue('/n/x.md');
    vi.mocked(promoteUntitled).mockRejectedValueOnce('locked');
    expect(await saveTab('u')).toBe(true);
    expect(h.tabs[0].filePath).toBe('/n/x.md');
    expect(rewriteImagePrefix).not.toHaveBeenCalled();
    const [what, , key, actions] = vi.mocked(showError).mock.calls[0];
    expect(what).toBe('move the images of Untitled-1');
    expect(key).toBe('images:u');
    actions![0].run();
    await tick();
    expect(rewriteImagePrefix).toHaveBeenCalledWith('u', MOVE);
    expect(clearInfo).toHaveBeenCalledWith('images:u');
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
    expect(writeNote).toHaveBeenCalledTimes(1);
    expect(writeNote).toHaveBeenCalledWith('/m/b.md', 'rewritten', { eol: 'crlf' }, null);
    expect(rewriteImagePrefix).toHaveBeenCalledWith('d', MOVE);
    expect(markSaved).toHaveBeenCalledWith('d', expect.objectContaining({ path: '/m/b.md', text: 'rewritten' }));
  });

  it('a failing write leaves the tab, its links and its path untouched', async () => {
    h.tabs = [mk('d')];
    vi.mocked(pickSavePath).mockResolvedValue('/m/b.md');
    vi.mocked(copyAssets).mockResolvedValue({ from: 'd.assets/', to: 'b.assets/' });
    vi.mocked(writeNote).mockRejectedValue('read-only');
    expect(await saveAs('d')).toBe(false);
    expect(rewriteImagePrefix).not.toHaveBeenCalled();
    expect(markSaved).not.toHaveBeenCalled();
    expect(h.tabs[0].filePath).toBe('/n/d.md');
  });

  it('the same path is a plain save without copying', async () => {
    h.tabs = [mk('d')];
    vi.mocked(pickSavePath).mockResolvedValue('/n/d.md');
    expect(await saveAs('d')).toBe(true);
    expect(copyAssets).not.toHaveBeenCalled();
    expect(writeNote).toHaveBeenCalledWith('/n/d.md', 'text d', undefined, undefined);
  });
});
