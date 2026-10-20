import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSession } from './session';

vi.mock('./ipc', () => ({ saveSessionRaw: vi.fn(), loadSessionRaw: vi.fn() }));
vi.mock('./infobar', () => ({ showError: vi.fn(), clearInfo: vi.fn() }));

describe('parseSession', () => {
  it('round-trips a v3 session', () => {
    const s = {
      version: 3,
      activeTabId: 'b',
      untitledCounter: 4,
      lastFolder: 'C:/Users/x/Documents/Notes',
      tabs: [
        { id: 'a', title: 'a.md', filePath: 'C:/n/a.md', content: '# a', dirty: false, mode: 'edit', cursor: 2, scrollTop: 10 },
        { id: 'b', title: 'Untitled-3', filePath: null, content: 'x', dirty: true, mode: 'read', cursor: 0, scrollTop: 0 }
      ],
      closedTabs: []
    };
    expect(parseSession(JSON.stringify(s))).toEqual(s);
  });

  it('reads the prototype format', () => {
    const old = {
      version: 2,
      activeTabId: 'missing',
      tabs: [{ id: 't1', title: 'Untitled-1', filePath: null, content: 'hi', dirty: true, mode: 'split', cursorPos: 5 }]
    };
    const s = parseSession(JSON.stringify(old))!;
    expect(s.activeTabId).toBe('t1');
    expect(s.tabs[0]).toMatchObject({ mode: 'edit', cursor: 5, scrollTop: 0 });
    expect(s.untitledCounter).toBe(2);
  });

  it('drops malformed tabs and rejects a session without usable tabs', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('not json')).toBeNull();
    expect(parseSession(JSON.stringify({ tabs: [{ title: 'no id' }, 7, null] }))).toBeNull();
    const s = parseSession(JSON.stringify({ tabs: [{ id: 'ok' }, { title: 'no id' }] }))!;
    expect(s.tabs.map((t) => t.id)).toEqual(['ok']);
  });
});

describe('session writes', () => {
  type Mod = typeof import('./session');
  let m: Mod;
  let ipc: typeof import('./ipc');
  let info: typeof import('./infobar');
  let n = 0;
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ipc = await import('./ipc');
    info = await import('./infobar');
    vi.mocked(ipc.saveSessionRaw).mockReset().mockResolvedValue(undefined);
    vi.mocked(info.showError).mockReset();
    m = await import('./session');
    n = 0;
    m.bindSessionSource(() => ({ version: 3, activeTabId: 'a', untitledCounter: ++n, lastFolder: null, tabs: [], closedTabs: [] }));
  });
  afterEach(() => vi.useRealTimers());

  it('an immediate save writes without waiting 500 ms', () => {
    m.scheduleSessionSave({ immediate: true });
    expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(0);
    return vi.advanceTimersByTimeAsync(0).then(() => expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(1));
  });

  it('several debounced calls inside 500 ms write once', async () => {
    m.scheduleSessionSave();
    await vi.advanceTimersByTimeAsync(200);
    m.scheduleSessionSave();
    m.scheduleSessionSave();
    await vi.advanceTimersByTimeAsync(299);
    expect(ipc.saveSessionRaw).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(1);
  });

  it('flushSession resolves only after the write resolved and cancels the debounce', async () => {
    let release!: () => void;
    vi.mocked(ipc.saveSessionRaw).mockReturnValue(new Promise<void>((r) => (release = r)));
    m.scheduleSessionSave();
    let done = false;
    void m.flushSession().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(1);
    expect(done).toBe(false);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(1);
  });

  it('flushSession resolves when the write rejected and reports it', async () => {
    vi.mocked(ipc.saveSessionRaw).mockRejectedValue(new Error('disk full'));
    await expect(m.flushSession()).resolves.toBeUndefined();
    expect(info.showError).toHaveBeenCalledTimes(1);
  });

  it('a failed write is retried by the next save of the same snapshot', async () => {
    m.bindSessionSource(() => ({ version: 3, activeTabId: 'a', untitledCounter: 1, lastFolder: null, tabs: [], closedTabs: [] }));
    vi.mocked(ipc.saveSessionRaw).mockRejectedValueOnce(new Error('locked'));
    await m.flushSession();
    await m.flushSession();
    expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(2);
    await m.flushSession(); // identical and succeeded: skipped
    expect(ipc.saveSessionRaw).toHaveBeenCalledTimes(2);
  });
});
