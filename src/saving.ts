// Saving notes. Phase 4 adds autosave, the first-save info bar and Save As.
import { pickSavePath, promoteScratchAssets, writeNote } from './ipc';
import { getTab, getTabs, markSaved, setLastFolder, textOf, untitledContentsExcept } from './tabs';
import { flushSession, scheduleSessionSave } from './session';
import { showError } from './infobar';
import { dirname, normPath } from './paths';

/** Tail of each tab's write chain: writes of one tab never overlap. */
const chains = new Map<string, Promise<unknown>>();
/** Tabs whose last write failed, with the reason. One bar names them all; a success removes the tab. */
const failures = new Map<string, { title: string; reason: unknown }>();
let dismissFailures = (): void => {};

function reportFailures(): void {
  for (const id of failures.keys()) if (!getTab(id)) failures.delete(id);
  if (failures.size === 0) {
    dismissFailures();
    return;
  }
  const list = [...failures.values()];
  dismissFailures = showError(`save ${list.map((f) => f.title).join(', ')}`, list[list.length - 1].reason);
}

function inChain<T>(id: string, job: () => Promise<T>): Promise<T> {
  const run = (chains.get(id) ?? Promise.resolve()).then(job);
  const tail = run.catch(() => {});
  chains.set(id, tail);
  void tail.then(() => {
    if (chains.get(id) === tail) chains.delete(id);
  });
  return run;
}

/** Ctrl+S. Disk tab: write. Untitled tab: ask for a path, move its images, write. */
export async function saveTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab) return false;
  const title = tab.title;
  // Text at call time, for a tab closed before its turn (its editor state is gone by then).
  const queued = textOf(tab);
  try {
    const ok = await inChain(id, async () => {
      // An open tab is read when its write starts, so the last write carries the newest text.
      const text = getTab(id) ? textOf(tab) : queued;
      if (tab.filePath) {
        await writeNote(tab.filePath, text);
        markSaved(id, text);
        return true;
      }
      const picked = await pickSavePath(tab.title);
      if (!picked) return false;
      const target = normPath(picked);
      await promoteScratchAssets(text, target, untitledContentsExcept(id));
      await writeNote(target, text);
      markSaved(id, text, target);
      setLastFolder(dirname(target));
      return true;
    });
    if (!ok) return false;
  } catch (err) {
    failures.delete(id); // re-insert last, so its reason is the one shown
    failures.set(id, { title, reason: err });
    reportFailures();
    return false;
  }
  if (failures.delete(id)) reportFailures();
  scheduleSessionSave({ immediate: true });
  return true;
}

/** Window blur and close: write every dirty disk tab. One failure never stops the others or the session save. */
export async function flushDirty(): Promise<void> {
  const first = flushSession(); // the session never waits for a note write
  const dirty = getTabs().filter((t) => t.dirty && t.filePath);
  await Promise.allSettled(dirty.map((t) => saveTab(t.id)));
  await Promise.allSettled([first, flushSession()]); // the saved flags land in the session
}
