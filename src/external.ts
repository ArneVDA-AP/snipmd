// External changes (SPEC §6.1): notes edited outside SnipMD are reloaded in place, or put in conflict.
import type { DiskStamp, TabState } from './types';
import { readNote, statNote } from './ipc';
import { getTab, getTabs, markSaved, openCopy } from './tabs';
import { applyToTab, getState } from './editor/registry';
import { inConflict, isWriting, setConflict } from './diskState';
import { saveTab } from './saving';
import { clearInfo, showError, showInfo } from './infobar';

const WATCH_MS = 2000;
const barKey = (id: string): string => `external:${id}`;
const same = (a: DiskStamp, b: DiskStamp): boolean => a.mtimeMs === b.mtimeMs && a.size === b.size;

/** Replaces only the changed middle of the document, so cursor and scroll stay where they were. */
function replaceMiddle(id: string, text: string): void {
  const old = getState(id)?.doc.toString();
  if (old === undefined) return;
  let from = 0;
  const max = Math.min(old.length, text.length);
  while (from < max && old[from] === text[from]) from++;
  let tail = 0;
  while (tail < max - from && old[old.length - 1 - tail] === text[text.length - 1 - tail]) tail++;
  applyToTab(id, { changes: { from, to: old.length - tail, insert: text.slice(from, text.length - tail) } });
}

/** Loads the file into the tab and marks it saved. */
async function reload(tab: TabState): Promise<void> {
  const file = await readNote(tab.filePath!);
  replaceMiddle(tab.id, file.text);
  tab.format = file.format;
  markSaved(tab.id, { text: file.text, stamp: file.stamp });
}

function resolve(tab: TabState, thenSave = false): void {
  setConflict(tab.id, false);
  clearInfo(barKey(tab.id));
  if (thenSave) void saveTab(tab.id);
}

function guarded(tab: TabState, what: string, fn: () => Promise<void>): () => void {
  return () => void fn().catch((err) => showError(`${what} ${tab.title}`, err, barKey(tab.id)));
}

function warnChanged(tab: TabState, stamp: DiskStamp): void {
  const show = (): void => warnChanged(tab, stamp);
  showInfo({
    kind: 'warning',
    key: barKey(tab.id),
    text: `${tab.title} was changed outside SnipMD and you have changes too.`,
    actions: [
      {
        label: 'Open disk version',
        run: guarded(tab, 'open the disk version of', async () => {
          const file = await readNote(tab.filePath!);
          await openCopy(`${tab.title} (disk)`, file.text, 'read');
          show(); // the bar stays: the choice about this tab is still open
        })
      },
      {
        label: 'Reload',
        run: guarded(tab, 'reload', async () => {
          await reload(tab);
          resolve(tab);
        })
      },
      {
        label: 'Keep mine',
        primary: true,
        run: () => {
          tab.disk = stamp;
          resolve(tab, true);
        }
      }
    ]
  });
}

function warnGone(tab: TabState): void {
  showInfo({
    kind: 'warning',
    key: barKey(tab.id),
    text: `${tab.title} is no longer on disk.`,
    actions: [{ label: 'Save again', primary: true, run: () => resolve(tab, true) }]
  });
}

async function checkTab(tab: TabState): Promise<void> {
  const known = tab.disk!;
  const stamp = await statNote(tab.filePath!);
  if (isWriting(tab.id) || inConflict(tab.id) || !getTab(tab.id)) return; // state moved on during the stat
  if (stamp === null) {
    tab.dirty = true;
    setConflict(tab.id, true);
    warnGone(tab);
    return;
  }
  if (same(stamp, known)) clearInfo(barKey(tab.id));
  else if (!tab.dirty) await reload(tab);
  else {
    setConflict(tab.id, true);
    warnChanged(tab, stamp);
  }
}

/** Compares every disk tab with its file. Never rejects; one failing tab does not stop the others. */
export async function checkTabs(): Promise<void> {
  const due = getTabs().filter((t) => t.filePath && t.disk && !isWriting(t.id) && !inConflict(t.id));
  await Promise.allSettled(due.map(checkTab));
}

let timer: ReturnType<typeof setInterval> | undefined;
const stop = (): void => clearInterval(timer);

function start(): void {
  void checkTabs();
  stop();
  timer = setInterval(() => {
    if (document.hasFocus()) void checkTabs();
  }, WATCH_MS);
}

/** Checks on window focus and every 2 s while the window has focus. */
export function startExternalWatch(): void {
  window.addEventListener('focus', start);
  window.addEventListener('blur', stop);
  if (document.hasFocus()) start();
}
