import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  tabs: [] as Array<{ id: string; title: string; filePath: string | null; dirty: boolean; text: string }>
}));

vi.mock('./ipc', () => ({ pickSavePath: vi.fn(), promoteUntitled: vi.fn(), writeNote: vi.fn() }));
vi.mock('./tabs', () => ({
  getTab: (id: string) => h.tabs.find((t) => t.id === id),
  getTabs: () => h.tabs,
  textOf: (t: { text: string }) => t.text,
  markSaved: vi.fn((id: string) => {
    const t = h.tabs.find((x) => x.id === id);
    if (t) t.dirty = false;
  }),
  setLastFolder: vi.fn()
}));
vi.mock('./session', () => ({ flushSession: vi.fn(() => Promise.resolve()), scheduleSessionSave: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), clearInfo: vi.fn() }));

import { flushDirty, saveTab } from './saving';
import { writeNote } from './ipc';
import { flushSession } from './session';
import { clearInfo, showError } from './infobar';

const mk = (id: string) => ({ id, title: id, filePath: `/n/${id}.md`, dirty: true, text: `text ${id}` });
const STAMP = { mtimeMs: 1, size: 1 };
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.tabs = [];
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
