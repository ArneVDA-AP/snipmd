// Saving notes: writes, autosave, the first save and Save As.
import type { DiskStamp, Expected, TabState, TextFormat } from './types';
import { claimNewNote, copyAssets, pickSavePath, promoteUntitled, writeNote } from './ipc';
import { askFirstSave } from './firstSaveBar';
import { rewriteImagePrefix, rewrittenText } from './editor/links';
import { beginWrite, endWrite, inConflict } from './diskState';
import { handleRefusedWrite, resolveConflict } from './external';
import { allTabs, getTab, markSaved, openTab, openTabAt, setLastFolder, textOf } from './tabs';
import { flushSession, scheduleSessionSave } from './session';
import { clearInfo, showError } from './infobar';
import { basename, dirname, normPath, samePath } from './paths';
import { imageSavesSettled } from './editor/registry';

/** Per tab: the write in progress, and the one write queued behind it that later saves join. */
const running = new Map<string, Promise<boolean>>();
const queued = new Map<string, Promise<boolean>>();

const AUTOSAVE_MS = 1000;
const errorKey = (id: string): string => `save:${id}`;
const imagesKey = (id: string): string => `images:${id}`;

/**
 * One note write, marked for the external-change watch. With `expected`, a file that is not what the
 * tab expects is not written: the watch is told and null comes back.
 */
async function writeFile(tab: TabState, path: string, text: string, format: TextFormat | null, expected: Expected): Promise<DiskStamp | null> {
  beginWrite(tab.id);
  try {
    const out = await writeNote(path, text, format, expected);
    if ('written' in out) return out.written;
    handleRefusedWrite(tab.id, out.changed);
    return null;
  } finally {
    endWrite(tab.id);
  }
}

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
    // Read when the write starts, so it carries the newest text. textOf covers a closed tab too: its kept editor state, or its content after a restart.
    const text = textOf(tab);
    try {
      if (inConflict(tab.id)) return false;
      const path = tab.filePath!;
      const stamp = await writeFile(tab, path, text, tab.format, tab.disk);
      if (!stamp) return false;
      // A Save As that switched the tab meanwhile owns its stamp now; this write was to the old file.
      if (tab.filePath === path) markSaved(tab.id, { text, stamp });
      clearInfo(errorKey(tab.id));
      return true;
    } catch (err) {
      showError(`save ${tab.title}`, err, errorKey(tab.id));
      return false;
    } finally {
      if (running.get(tab.id) === next) running.delete(tab.id);
    }
  });
  queued.set(tab.id, next);
  return next;
}

/**
 * Two open tabs on one file would write over each other, so a save never takes a path another open
 * tab holds. A closed tab may: reopening it joins the open one and keeps its unsaved text in a copy.
 */
function refuseHeld(tab: TabState, path: string): void {
  const held = openTabAt(path);
  if (held && held !== tab) throw new Error(`${basename(path)} is open in another tab`);
}

/**
 * Untitled tab: ask where, write the note, and only then move its images and rewrite the links. Until
 * the note is written the tab stays untitled with its text and images untouched.
 */
async function firstSave(tab: TabState): Promise<boolean> {
  let step = 'choose a place for';
  try {
    const choice = await askFirstSave(tab, textOf(tab));
    if (!choice) return false;
    step = 'save';
    if (choice !== 'other') refuseHeld(tab, `${choice.folder}/${choice.name}`); // before the claim creates the file
    const picked = choice === 'other' ? await pickSavePath(tab.title) : await claimNewNote(choice.folder, choice.name);
    if (!picked) return false;
    const target = normPath(picked);
    refuseHeld(tab, target);
    const text = textOf(tab);
    const stamp = await writeFile(tab, target, text, null, null);
    if (!stamp) return false;
    markSaved(tab.id, { text, stamp, path: target });
    setLastFolder(dirname(target));
    clearInfo(errorKey(tab.id));
  } catch (err) {
    showError(`${step} ${tab.title}`, err, errorKey(tab.id));
    return false;
  }
  await imageSavesSettled(tab.id); // a paste that started before the save may still land in scratch
  await moveImages(tab);
  return true;
}

/**
 * After a first save: moves the scratch images next to the note and rewrites their links (one undo
 * step; autosave writes the result). A failure keeps the images in scratch and offers to try again.
 */
async function moveImages(tab: TabState): Promise<void> {
  try {
    const move = await promoteUntitled(tab.id, tab.filePath!);
    if (move) rewriteImagePrefix(tab.id, move);
    clearInfo(imagesKey(tab.id));
  } catch (err) {
    // The images stay in the scratch folder; nothing is lost.
    const id = tab.id;
    showError(`move the images of ${tab.title}`, err, imagesKey(id), [
      { label: 'Try again', primary: true, run: () => {
        const t = getTab(id);
        if (t) void moveImages(t);
      } }
    ]);
  }
}

/**
 * Save As of a disk tab: copy the images, write the new file with the rewritten links, and only then
 * switch the tab to it. A failure leaves the tab, its links and the original untouched.
 */
async function copyTo(tab: TabState, old: string): Promise<boolean> {
  let step = 'choose a place for';
  try {
    const picked = await pickSavePath(tab.title);
    if (!picked) return false;
    const target = normPath(picked);
    if (samePath(target, old)) return saveTab(tab.id);
    step = 'save';
    refuseHeld(tab, target);
    step = 'copy the images of';
    const move = await copyAssets(old, target);
    step = 'save';
    const text = move ? rewrittenText(tab.id, move) : textOf(tab);
    const stamp = await writeFile(tab, target, text, tab.format, null);
    if (!stamp) return false;
    if (move) rewriteImagePrefix(tab.id, move);
    markSaved(tab.id, { text, stamp, path: target });
    resolveConflict(tab.id); // the new file has no outside change to settle
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

/** Ctrl+S, and the write when a tab closes. A tab in conflict is not written. */
export async function saveTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab || inConflict(id)) return false;
  const ok = await (tab.filePath ? writeTab(tab) : startFirstSave(tab, firstSave));
  if (ok) scheduleSessionSave({ immediate: true });
  return ok;
}

/** Ctrl+Shift+S. */
export async function saveAs(id: string): Promise<boolean> {
  const tab = openTab(id);
  if (!tab) return false;
  const old = tab.filePath;
  const ok = await startFirstSave(tab, old ? (t) => copyTo(t, old) : firstSave);
  if (ok) scheduleSessionSave({ immediate: true });
  return ok;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Called on every edit: saves a dirty disk tab 1 s after the last one. */
export function scheduleAutosave(id: string): void {
  if (!getTab(id)?.filePath) return; // untitled tabs live in the session until their first save
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      const tab = getTab(id); // also a closed tab: a link rewrite after its first save is written
      // markSaved writes the session at once (SPEC §7: right after a save).
      if (tab?.filePath && tab.dirty && !inConflict(id)) void writeTab(tab);
    }, AUTOSAVE_MS)
  );
}

/** Window blur and close: write every dirty disk tab, closed ones included. One failure never stops the others or the session save. */
export async function flushDirty(): Promise<void> {
  void flushSession(); // the session never waits for a note write
  await imageSavesSettled(); // a screenshot still saving lands in its tab first (close right after Ctrl+V)
  await Promise.all(allTabs().filter((t) => t.dirty && t.filePath && !inConflict(t.id)).map(writeTab));
  await flushSession(); // the saved flags land in the session
}
