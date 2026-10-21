// Saving notes. Phase 4 adds autosave, the first-save info bar and Save As.
import type { TabState } from './types';
import { claimNewNote, copyAssets, pickSavePath, promoteUntitled, writeNote } from './ipc';
import { askFirstSave } from './firstSaveBar';
import { rewriteImagePrefix } from './editor/links';
import { beginWrite, endWrite, inConflict, setConflict } from './diskState';
import { getTab, getTabs, markSaved, setLastFolder, textOf } from './tabs';
import { flushSession, scheduleSessionSave } from './session';
import { clearInfo, showError } from './infobar';
import { dirname, normPath, samePath } from './paths';

/** Per tab: the write in progress, and the one write queued behind it that later saves join. */
const running = new Map<string, Promise<boolean>>();
const queued = new Map<string, Promise<boolean>>();

const AUTOSAVE_MS = 1000;
const errorKey = (id: string): string => `save:${id}`;

/**
 * Writes a disk tab's newest text. Writes of one tab never overlap, and saves asked for while
 * one runs merge into a single follow-up write. Reports its own failure; never rejects.
 */
function writeTab(tab: TabState): Promise<boolean> {
  const waiting = queued.get(tab.id);
  if (waiting) return waiting;
  const next: Promise<boolean> = (running.get(tab.id) ?? Promise.resolve(true)).then(async () => {
    queued.delete(tab.id);
    running.set(tab.id, next);
    // Read when the write starts, so it carries the newest text. A closed tab keeps its text in content.
    const text = textOf(tab);
    beginWrite(tab.id);
    try {
      if (inConflict(tab.id)) return false;
      const stamp = await writeNote(tab.filePath!, text, tab.format);
      markSaved(tab.id, { text, stamp });
      clearInfo(errorKey(tab.id));
      return true;
    } catch (err) {
      showError(`save ${tab.title}`, err, errorKey(tab.id));
      return false;
    } finally {
      endWrite(tab.id);
      if (running.get(tab.id) === next) running.delete(tab.id);
    }
  });
  queued.set(tab.id, next);
  return next;
}

/** Untitled tab: ask where, move its images into place, rewrite the links, write. On any failure it stays untitled. */
async function firstSave(tab: TabState): Promise<boolean> {
  let step = 'choose a place for';
  try {
    const choice = await askFirstSave(tab, textOf(tab));
    const picked = choice === 'other' ? await pickSavePath(tab.title) : choice && (await claimNewNote(choice.folder, choice.name));
    if (!picked) return false;
    const target = normPath(picked);
    step = 'move the images of';
    const move = await promoteUntitled(tab.id, target);
    if (move) rewriteImagePrefix(tab.id, move);
    step = 'save';
    const text = textOf(tab);
    beginWrite(tab.id);
    try {
      const stamp = await writeNote(target, text, null);
      markSaved(tab.id, { text, stamp, path: target });
    } finally {
      endWrite(tab.id);
    }
    setLastFolder(dirname(target));
    clearInfo(errorKey(tab.id));
    return true;
  } catch (err) {
    showError(`${step} ${tab.title}`, err, errorKey(tab.id));
    return false;
  }
}

/** Save As of a disk tab: copy the images, rewrite the links, write the new file. The original stays untouched. */
async function copyTo(tab: TabState, old: string): Promise<boolean> {
  let step = 'choose a place for';
  try {
    const picked = await pickSavePath(tab.title);
    if (!picked) return false;
    const target = normPath(picked);
    if (samePath(target, old)) return saveTab(tab.id);
    step = 'copy the images of';
    const move = await copyAssets(old, target);
    if (move) rewriteImagePrefix(tab.id, move);
    step = 'save';
    const text = textOf(tab);
    beginWrite(tab.id);
    try {
      const stamp = await writeNote(target, text, tab.format);
      markSaved(tab.id, { text, stamp, path: target });
    } finally {
      endWrite(tab.id);
    }
    setConflict(tab.id, false);
    clearInfo(`external:${tab.id}`);
    setLastFolder(dirname(target));
    clearInfo(errorKey(tab.id));
    return true;
  } catch (err) {
    showError(`${step} ${tab.title}`, err, errorKey(tab.id));
    return false;
  }
}

/** One first save per tab at a time: a second Ctrl+S joins the open bar. */
const firstSaves = new Map<string, Promise<boolean>>();

function startFirstSave(tab: TabState, run: (t: TabState) => Promise<boolean>): Promise<boolean> {
  const open = firstSaves.get(tab.id);
  if (open) return open;
  const p = run(tab).finally(() => firstSaves.delete(tab.id));
  firstSaves.set(tab.id, p);
  return p;
}

/** Ctrl+S. A tab in conflict is not written. */
export async function saveTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab || inConflict(id)) return false;
  const ok = await (tab.filePath ? writeTab(tab) : startFirstSave(tab, firstSave));
  if (ok) scheduleSessionSave({ immediate: true });
  return ok;
}

/** Ctrl+Shift+S. */
export async function saveAs(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab) return false;
  const old = tab.filePath;
  const ok = await startFirstSave(tab, old ? (t) => copyTo(t, old) : firstSave);
  if (ok) scheduleSessionSave({ immediate: true });
  return ok;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Called on every edit: saves a dirty disk tab 1 s after the last one. */
export function scheduleAutosave(id: string): void {
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      const tab = getTab(id);
      if (tab?.filePath && tab.dirty) void saveTab(id);
    }, AUTOSAVE_MS)
  );
}

/** Window blur and close: write every dirty disk tab. One failure never stops the others or the session save. */
export async function flushDirty(): Promise<void> {
  void flushSession(); // the session never waits for a note write
  await Promise.all(getTabs().filter((t) => t.dirty && t.filePath && !inConflict(t.id)).map(writeTab));
  await flushSession(); // the saved flags land in the session
}
