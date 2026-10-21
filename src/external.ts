// External changes (SPEC §6.1): notes edited outside SnipMD are reloaded in place, or put in conflict.
// This module owns the conflict state of a tab and its bar; saving asks it through resolveConflict
// and handleRefusedWrite. Bar actions hold only the tab id and look the tab up when they run.
import type { DiskStamp, TabState } from './types';
import { readNote, statNote } from './ipc';
import { getTab, getTabs, loadText, markDirty, markSaved, openCopy } from './tabs';
import { inConflict, isWriting, setConflict, writeGeneration } from './diskState';
import { clearInfo, showError, showInfo } from './infobar';

const WATCH_MS = 2000;
const barKey = (id: string): string => `external:${id}`;
/** Errors of the bar's actions get their own key, so the conflict bar and its choices stay. */
const errorKey = (id: string): string => `external-error:${id}`;
const same = (a: DiskStamp, b: DiskStamp): boolean => a.mtimeMs === b.mtimeMs && a.size === b.size;

/** Saving, bound by startExternalWatch (saving imports this module, not the other way round). */
let save: (id: string) => Promise<boolean> = async () => false;

/**
 * Loads the file into the tab and marks it saved. With `onlyIfClean`, edits typed during the read win:
 * the tab goes into conflict instead.
 */
async function reload(tab: TabState, onlyIfClean: boolean): Promise<void> {
  const file = await readNote(tab.filePath!);
  if (onlyIfClean && tab.dirty) return raiseChanged(tab, file.stamp);
  loadText(tab, file.text);
  tab.format = file.format;
  markSaved(tab.id, { text: file.text, stamp: file.stamp });
}

/** Ends a tab's conflict and removes its bars. Also called by Save As, which settles it too. */
export function resolveConflict(id: string): void {
  setConflict(id, false);
  clearInfo(barKey(id));
  clearInfo(errorKey(id));
}

/** A bar action for tab `id`: it runs only while the tab is open, and a failure is reported beside the bar. */
function act(id: string, label: string, what: string, run: (tab: TabState) => Promise<void> | void, primary = false) {
  return {
    label,
    primary,
    keepOpen: true, // the bar goes through resolveConflict once the choice is made
    run: () => {
      const tab = getTab(id);
      if (!tab) return clearInfo(barKey(id));
      void Promise.resolve(run(tab)).catch((err) => showError(`${what} ${tab.title}`, err, errorKey(id)));
    }
  };
}

function raiseChanged(tab: TabState, stamp: DiskStamp): void {
  setConflict(tab.id, true);
  const id = tab.id;
  showInfo({
    kind: 'warning',
    key: barKey(id),
    sticky: true,
    text: `${tab.title} was changed outside SnipMD and you have changes too.`,
    actions: [
      act(id, 'Open disk version', 'open the disk version of', async (t) => {
        const file = await readNote(t.filePath!);
        await openCopy(`${t.title} (disk)`, file.text, t.id);
      }),
      act(id, 'Reload', 'reload', async (t) => {
        await reload(t, false);
        resolveConflict(id);
      }),
      act(id, 'Keep mine', 'save', (t) => {
        t.disk = stamp; // the version on disk now is the one being replaced
        resolveConflict(id);
        return void save(id);
      }, true)
    ]
  });
}

function raiseGone(tab: TabState): void {
  setConflict(tab.id, true);
  markDirty(tab.id); // the session keeps the text now that the file is gone
  const id = tab.id;
  showInfo({
    kind: 'warning',
    key: barKey(id),
    sticky: true,
    text: `${tab.title} is no longer on disk.`,
    actions: [
      act(id, 'Save again', 'save', (t) => {
        t.disk = null; // nothing to compare with: the write recreates the file
        resolveConflict(id);
        return void save(id);
      }, true)
    ]
  });
}

/** The file is not the one the tab knows: reload a clean tab, put a dirty one in conflict, or report it gone. */
async function outside(tab: TabState, stamp: DiskStamp | null): Promise<void> {
  if (stamp === null) raiseGone(tab);
  else if (tab.dirty) raiseChanged(tab, stamp);
  else await reload(tab, true);
}

/** Saving calls this when Rust refused a write because the file changed or went away meanwhile. */
export function handleRefusedWrite(id: string, stamp: DiskStamp | null): void {
  const tab = getTab(id);
  if (tab?.filePath && !inConflict(id)) void outside(tab, stamp).catch(() => {});
}

async function checkTab(tab: TabState): Promise<void> {
  const generation = writeGeneration(tab.id);
  const stamp = await statNote(tab.filePath!);
  // A write that started or ended during the stat makes its answer stale; the next check sees the truth.
  if (writeGeneration(tab.id) !== generation || isWriting(tab.id) || inConflict(tab.id) || !getTab(tab.id)) return;
  if (stamp && tab.disk && same(stamp, tab.disk)) clearInfo(barKey(tab.id));
  else await outside(tab, stamp);
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

/**
 * Checks now (restored dirty tabs against their files, SPEC §7), on window focus, and every 2 s
 * while the window has focus. `saveTab` is how a conflict choice writes the tab.
 */
export function startExternalWatch(saveTab: (id: string) => Promise<boolean>): void {
  save = saveTab;
  window.addEventListener('focus', start);
  window.addEventListener('blur', stop);
  if (document.hasFocus()) start();
  else void checkTabs();
}
