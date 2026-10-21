// External changes (SPEC §6.1): notes edited outside SnipMD are reloaded in place, or put in conflict.
import type { DiskStamp, TabState } from './types';
import { readNote, statNote } from './ipc';
import { getTab, getTabs, markDirty, markSaved, openCopy } from './tabs';
import { applyToTab, getState } from './editor/registry';
import { bindOutsideChange, inConflict, isWriting, setConflict, writeGeneration } from './diskState';
import { saveTab } from './saving';
import { clearInfo, showError, showInfo } from './infobar';

const WATCH_MS = 2000;
const barKey = (id: string): string => `external:${id}`;
/** Errors of the bar's actions get their own key, so the conflict bar and its choices stay. */
const errorKey = (id: string): string => `external-error:${id}`;
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

/**
 * Loads the file into the tab and marks it saved. With `onlyIfClean`, edits typed during the read win:
 * the tab goes into conflict instead. Returns false when it did not reload.
 */
async function reload(tab: TabState, onlyIfClean: boolean): Promise<boolean> {
  const file = await readNote(tab.filePath!);
  if (onlyIfClean && tab.dirty) {
    raiseConflict(tab, file.stamp);
    return false;
  }
  replaceMiddle(tab.id, file.text);
  tab.format = file.format;
  markSaved(tab.id, { text: file.text, stamp: file.stamp });
  return true;
}

function raiseConflict(tab: TabState, stamp: DiskStamp): void {
  setConflict(tab.id, true);
  warnChanged(tab, stamp);
}

function resolve(tab: TabState, thenSave = false): void {
  setConflict(tab.id, false);
  clearInfo(barKey(tab.id));
  clearInfo(errorKey(tab.id));
  if (thenSave) void saveTab(tab.id);
}

/** Runs a bar action; the bar is shown again (its choice is still open) and a failure is reported beside it. */
function guarded(tab: TabState, what: string, show: () => void, fn: () => Promise<void>): () => void {
  return () =>
    void fn().catch((err) => {
      show();
      showError(`${what} ${tab.title}`, err, errorKey(tab.id));
    });
}

function warnChanged(tab: TabState, stamp: DiskStamp): void {
  const show = (): void => warnChanged(tab, stamp);
  showInfo({
    kind: 'warning',
    key: barKey(tab.id),
    sticky: true,
    text: `${tab.title} was changed outside SnipMD and you have changes too.`,
    actions: [
      {
        label: 'Open disk version',
        run: guarded(tab, 'open the disk version of', show, async () => {
          const file = await readNote(tab.filePath!);
          await openCopy(`${tab.title} (disk)`, file.text, 'read');
          show(); // the bar stays: the choice about this tab is still open
        })
      },
      {
        label: 'Reload',
        run: guarded(tab, 'reload', show, async () => {
          await reload(tab, false);
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
    sticky: true,
    text: `${tab.title} is no longer on disk.`,
    actions: [
      {
        label: 'Save again',
        primary: true,
        run: () => {
          tab.disk = null; // nothing to compare with: the write recreates the file
          resolve(tab, true);
        }
      }
    ]
  });
}

async function checkTab(tab: TabState): Promise<void> {
  const generation = writeGeneration(tab.id);
  const stamp = await statNote(tab.filePath!);
  // A write that started or ended during the stat makes its answer stale; the next check sees the truth.
  if (writeGeneration(tab.id) !== generation || isWriting(tab.id) || inConflict(tab.id) || !getTab(tab.id)) return;
  if (stamp && tab.disk && same(stamp, tab.disk)) clearInfo(barKey(tab.id));
  else await outside(tab, stamp);
}

/** The file is not the one the tab knows: reload a clean tab, put a dirty one in conflict, or report it gone. */
async function outside(tab: TabState, stamp: DiskStamp | null): Promise<void> {
  if (stamp === null) {
    setConflict(tab.id, true);
    markDirty(tab.id); // the session keeps the text now that the file is gone
    warnGone(tab);
  } else if (tab.dirty) raiseConflict(tab, stamp);
  else await reload(tab, true);
}

// A write that Rust refused because the file changed meanwhile ends up here too.
bindOutsideChange((id, stamp) => {
  const tab = getTab(id);
  if (tab?.filePath && !inConflict(id)) void outside(tab, stamp).catch(() => {});
});

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
