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
        { id: 'a', title: 'a.md', filePath: 'C:/n/a.md', content: '# a', dirty: false, mode: 'edit', cursor: 2, scrollTop: 10,
          disk: { mtimeMs: 1700000000000, size: 3 }, format: { crlf: true, bom: false } },
        { id: 'b', title: 'Untitled-3', filePath: null, content: 'x', dirty: true, mode: 'read', cursor: 0, scrollTop: 0, disk: null, format: null }
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
    expect(parseSession('')).toBeNull();
    expect(parseSession('not json')).toBeNull();
    expect(parseSession('"a string"')).toBeNull();
    expect(parseSession('[1]')).toBeNull();
    expect(parseSession(JSON.stringify({ tabs: [{ title: 'no id' }, { id: '' }, 7, null] }))).toBeNull();
    expect(parseSession(JSON.stringify({ tabs: 'not a list' }))).toBeNull();
    const s = parseSession(JSON.stringify({ tabs: [{ id: 'ok' }, { title: 'no id' }] }))!;
    expect(s.tabs.map((t) => t.id)).toEqual(['ok']);
    expect(s.tabs[0]).toEqual({ id: 'ok', title: 'Untitled', filePath: null, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: null, format: null });
    expect(s).toMatchObject({ activeTabId: 'ok', untitledCounter: 2, lastFolder: null, closedTabs: [] });
  });

  it('an empty file path is an untitled tab, so its text is restored instead of read from a file', () => {
    const s = parseSession(JSON.stringify({ tabs: [{ id: 'e', filePath: '', content: 'draft', dirty: true }, { id: 'n', filePath: 'C:\\n\\a.md' }] }))!;
    expect(s.tabs[0].filePath).toBeNull();
    expect(s.tabs[0].content).toBe('draft');
    expect(s.tabs[1].filePath).toBe('C:/n/a.md');
  });

  it('a stamp or format missing a field is unknown, not half known', () => {
    const s = parseSession(JSON.stringify({ tabs: [
      { id: 'a', disk: { mtimeMs: 1 }, format: { crlf: true } },
      { id: 'b', disk: { mtimeMs: '1', size: 2 }, format: { crlf: 'yes', bom: false } },
      { id: 'c', disk: { mtimeMs: 1, size: 2 }, format: { crlf: true, bom: false }, cursor: 'x', scrollTop: null, mode: 'preview' },
      { id: 'd', filePath: 7, mode: 'read' },
      { id: 5 }
    ], lastFolder: '' }))!;
    expect(s.tabs.map((t) => [t.disk, t.format])).toEqual([[null, null], [null, null], [{ mtimeMs: 1, size: 2 }, { crlf: true, bom: false }], [null, null]]);
    expect(s.tabs[2]).toMatchObject({ cursor: 0, scrollTop: 0, mode: 'read' });
    expect(s.tabs[3]).toMatchObject({ filePath: null, mode: 'read' });
    expect(s.lastFolder).toBeNull();
    expect(parseSession(JSON.stringify({ tabs: [{ id: 'k' }], lastFolder: 7 }))!.lastFolder).toBeNull();
    expect(parseSession('null')).toBeNull();
  });

  it('closed tabs keep their tab and time; a time in the future is clamped to now, and an entry without a tab goes', () => {
    const now = Date.now();
    const s = parseSession(JSON.stringify({ tabs: [{ id: 'k' }], closedTabs: [
      { tab: { id: 'c1', content: 'x' }, closedAt: now - 1000 },
      { tab: { id: 'c2' }, closedAt: now + 1e9 },
      { tab: { title: 'no id' }, closedAt: 1 },
      { closedAt: 1 },
      null
    ] }))!;
    expect(s.closedTabs.map((c) => c.tab.id)).toEqual(['c1', 'c2']);
    expect(s.closedTabs[0].closedAt).toBe(now - 1000);
    expect(s.closedTabs[1].closedAt).toBeLessThanOrEqual(Date.now());
    expect(parseSession(JSON.stringify({ tabs: [{ id: 'k' }], closedTabs: 'no' }))!.closedTabs).toEqual([]);
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
    vi.mocked(info.clearInfo).mockReset();
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
    await vi.advanceTimersByTimeAsync(2000); // the later calls started no timer of their own
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

  it('flushSession resolves when the write rejected and reports it once, keyed, until a write succeeds', async () => {
    vi.mocked(ipc.saveSessionRaw).mockRejectedValue(new Error('disk full'));
    await expect(m.flushSession()).resolves.toBeUndefined();
    expect(info.showError).toHaveBeenCalledTimes(1);
    expect(info.showError).toHaveBeenCalledWith('save the session', expect.any(Error), 'session');
    await m.flushSession();
    expect(info.showError).toHaveBeenCalledTimes(1);
    expect(info.clearInfo).not.toHaveBeenCalled();
    vi.mocked(ipc.saveSessionRaw).mockResolvedValue(undefined);
    await m.flushSession();
    expect(info.clearInfo).toHaveBeenCalledWith('session');
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
