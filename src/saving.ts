// Saving notes. Phase 4 adds autosave, the first-save info bar and Save As.
import type { TabState } from './types';
import { pickSavePath, promoteUntitled, writeNote } from './ipc';
import { getTab, getTabs, markSaved, setLastFolder, textOf } from './tabs';
import { flushSession, scheduleSessionSave } from './session';
import { clearInfo, showError } from './infobar';
import { dirname, normPath } from './paths';

/** Per tab: the write in progress, and the one write queued behind it that later saves join. */
const running = new Map<string, Promise<boolean>>();
const queued = new Map<string, Promise<boolean>>();

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
    try {
      const stamp = await writeNote(tab.filePath!, text, tab.format);
      markSaved(tab.id, { text, stamp });
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

/** Untitled tab: ask for a path, move its images, write. */
async function firstSave(tab: TabState): Promise<boolean> {
  try {
    const picked = await pickSavePath(tab.title);
    if (!picked) return false;
    const target = normPath(picked);
    const text = textOf(tab);
    await promoteUntitled(tab.id, target); // phase 4 B3: rewrite the links it returns
    const stamp = await writeNote(target, text, null);
    markSaved(tab.id, { text, stamp, path: target });
    setLastFolder(dirname(target));
    clearInfo(errorKey(tab.id));
    return true;
  } catch (err) {
    showError(`save ${tab.title}`, err, errorKey(tab.id));
    return false;
  }
}

/** Ctrl+S. */
export async function saveTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab) return false;
  const ok = await (tab.filePath ? writeTab(tab) : firstSave(tab));
  if (ok) scheduleSessionSave({ immediate: true });
  return ok;
}

/** Window blur and close: write every dirty disk tab. One failure never stops the others or the session save. */
export async function flushDirty(): Promise<void> {
  void flushSession(); // the session never waits for a note write
  await Promise.all(getTabs().filter((t) => t.dirty && t.filePath).map(writeTab));
  await flushSession(); // the saved flags land in the session
}
