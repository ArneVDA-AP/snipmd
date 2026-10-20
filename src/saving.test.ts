import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  tabs: [] as Array<{ id: string; title: string; filePath: string | null; dirty: boolean; text: string }>
}));

vi.mock('./ipc', () => ({ pickSavePath: vi.fn(), promoteScratchAssets: vi.fn(), writeNote: vi.fn() }));
vi.mock('./tabs', () => ({
  getTab: (id: string) => h.tabs.find((t) => t.id === id),
  getTabs: () => h.tabs,
  textOf: (t: { text: string }) => t.text,
  markSaved: vi.fn((id: string) => {
    const t = h.tabs.find((x) => x.id === id);
    if (t) t.dirty = false;
  }),
  setLastFolder: vi.fn(),
  untitledContentsExcept: vi.fn(() => [])
}));
vi.mock('./session', () => ({ flushSession: vi.fn(() => Promise.resolve()), scheduleSessionSave: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn() }));

import { flushDirty, saveTab } from './saving';
import { writeNote } from './ipc';
import { flushSession } from './session';
import { showError } from './infobar';

const mk = (id: string) => ({ id, title: id, filePath: `/n/${id}.md`, dirty: true, text: `text ${id}` });
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  h.tabs = [];
  vi.mocked(flushSession).mockImplementation(() => Promise.resolve());
  vi.mocked(writeNote).mockResolvedValue(undefined as never);
  vi.mocked(showError).mockReturnValue(() => {});
});

describe('flushDirty', () => {
  it('one rejected write leaves the other tabs saved and the session flushed', async () => {
    h.tabs = [mk('a'), mk('b'), mk('c')];
    vi.mocked(writeNote).mockImplementation(async (p: string) => {
      if (p.includes('/b.')) throw 'disk full';
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

  it('dismisses the tab error after a later success', async () => {
    h.tabs = [mk('s2')];
    const dismiss = vi.fn();
    vi.mocked(showError).mockReturnValue(dismiss);
    vi.mocked(writeNote).mockRejectedValueOnce('locked');
    expect(await saveTab('s2')).toBe(false);
    expect(dismiss).not.toHaveBeenCalled();
    expect(await saveTab('s2')).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('saveTab and closed tabs', () => {
  it('a save queued behind a write still writes its own text after the tab closed', async () => {
    const tab = mk('c1');
    h.tabs = [tab];
    let release!: () => void;
    const writes: string[] = [];
    vi.mocked(writeNote).mockImplementation(async (_p: string, text: string) => {
      writes.push(text);
      if (writes.length === 1) await new Promise<void>((r) => (release = r));
    });
    tab.text = 'v2';
    const p1 = saveTab('c1');
    await tick();
    tab.text = 'v3';
    const p2 = saveTab('c1');
    // Closing drops the editor state: the real textOf falls back to the open-time text.
    h.tabs = [];
    tab.text = 'v1';
    release();
    await Promise.all([p1, p2]);
    expect(writes).toEqual(['v2', 'v3']);
  });
});

describe('write failures', () => {
  it('one bar names every failing tab; a success removes only that tab', async () => {
    h.tabs = [mk('f1'), mk('f2')];
    vi.mocked(writeNote).mockRejectedValue('drive removed');
    await flushDirty();
    expect(vi.mocked(showError).mock.lastCall?.[0]).toBe('save f1, f2');
    vi.mocked(writeNote).mockResolvedValue(undefined as never);
    await saveTab('f1');
    expect(vi.mocked(showError).mock.lastCall?.[0]).toBe('save f2');
  });
});
