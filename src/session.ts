// Session persistence: %APPDATA%/com.snipmd.desktop/session.json is the only store (SPEC §7).
import type { ClosedTab, DiskStamp, SessionFile, TabState, TextFormat } from './types';
import { loadSessionRaw, saveSessionRaw } from './ipc';
import { clearInfo, showError } from './infobar';
import { normPath } from './paths';

const DEBOUNCE_MS = 500;
const SESSION_ERROR = 'session';

let source: (() => SessionFile) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<void> = Promise.resolve();
let failing = false;
/** Last JSON handed to the write queue; an identical snapshot is not written again. */
let lastQueued = '';

export function bindSessionSource(fn: () => SessionFile): void {
  source = fn;
}

/** Debounced to at most one write per 500 ms; `immediate` writes now. Writes never overlap. */
export function scheduleSessionSave(opts?: { immediate?: boolean }): void {
  if (opts?.immediate) {
    void flushSession();
    return;
  }
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    enqueueWrite();
  }, DEBOUNCE_MS);
}

/** T2b. Cancels a pending debounce, writes the current snapshot now and resolves when every queued write is done. Never rejects. */
export function flushSession(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  enqueueWrite();
  return queue;
}

function enqueueWrite(): void {
  if (!source) return;
  const json = JSON.stringify(source());
  if (json === lastQueued) return;
  lastQueued = json;
  queue = queue.then(async () => {
    try {
      await saveSessionRaw(json);
      if (failing) clearInfo(SESSION_ERROR);
      failing = false;
    } catch (err) {
      if (lastQueued === json) lastQueued = ''; // retry on the next save
      // Keyed: it stays under newer messages until a session write succeeds.
      if (!failing) showError('save the session', err, SESSION_ERROR);
      failing = true;
    }
  });
}

export async function loadSession(): Promise<SessionFile | null> {
  return parseSession(await loadSessionRaw());
}

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function parseTab(raw: unknown): TabState | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || !t.id) return null;
  const filePath = typeof t.filePath === 'string' && t.filePath ? normPath(t.filePath) : null;
  return {
    id: t.id,
    title: str(t.title, 'Untitled'),
    filePath,
    content: str(t.content, ''),
    dirty: t.dirty === true,
    // The prototype used 'preview' and 'split'; both map to the closest v1 mode.
    mode: t.mode === 'read' || t.mode === 'preview' ? 'read' : 'edit',
    cursor: num(t.cursor ?? t.cursorPos),
    scrollTop: num(t.scrollTop),
    disk: parseStamp(t.disk),
    format: parseFormat(t.format)
  };
}

function parseStamp(raw: unknown): DiskStamp | null {
  const s = raw as { mtimeMs?: unknown; size?: unknown } | null;
  return s && typeof s.mtimeMs === 'number' && typeof s.size === 'number' ? { mtimeMs: s.mtimeMs, size: s.size } : null;
}

function parseFormat(raw: unknown): TextFormat | null {
  const f = raw as { crlf?: unknown; bom?: unknown } | null;
  return f && typeof f.crlf === 'boolean' && typeof f.bom === 'boolean' ? { crlf: f.crlf, bom: f.bom } : null;
}

/** Parses session.json leniently, including the prototype's format. Returns null when nothing usable is in it. */
export function parseSession(raw: string | null): SessionFile | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const tabs = (Array.isArray(d.tabs) ? d.tabs : []).map(parseTab).filter((t): t is TabState => t !== null);
  if (tabs.length === 0) return null;
  const closedTabs: ClosedTab[] = (Array.isArray(d.closedTabs) ? d.closedTabs : []).flatMap((c: unknown) => {
    const rec = c as { tab?: unknown; closedAt?: unknown } | null;
    const tab = rec ? parseTab(rec.tab) : null;
    return tab ? [{ tab, closedAt: num(rec!.closedAt) }] : [];
  });
  const active = str(d.activeTabId, '');
  return {
    version: 3,
    activeTabId: tabs.some((t) => t.id === active) ? active : tabs[0].id,
    untitledCounter: Math.max(1, num(d.untitledCounter) || tabs.length + 1),
    lastFolder: typeof d.lastFolder === 'string' && d.lastFolder ? d.lastFolder : null,
    tabs,
    closedTabs
  };
}
