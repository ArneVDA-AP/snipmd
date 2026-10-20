// Saving notes. Phase 4 adds autosave, the first-save info bar and Save As.
import { pickSavePath, promoteScratchAssets, writeNote } from './ipc';
import { getTab, getTabs, markSaved, setLastFolder, textOf, untitledContentsExcept } from './tabs';
import { scheduleSessionSave } from './session';
import { showError } from './infobar';
import { dirname, normPath } from './paths';

/** Ctrl+S. Disk tab: write. Untitled tab: ask for a path, move its images, write. */
export async function saveTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab) return false;
  const text = textOf(tab);
  try {
    if (tab.filePath) {
      await writeNote(tab.filePath, text);
      markSaved(id, text);
    } else {
      const picked = await pickSavePath(tab.title);
      if (!picked) return false;
      const target = normPath(picked);
      await promoteScratchAssets(text, target, untitledContentsExcept(id));
      await writeNote(target, text);
      markSaved(id, text, target);
      setLastFolder(dirname(target));
    }
  } catch (err) {
    showError(`save ${tab.title}`, err);
    return false;
  }
  scheduleSessionSave({ immediate: true });
  return true;
}

/** Window blur and close: write every dirty disk tab. One failure never stops the others or the session save. */
export async function flushDirty(): Promise<void> {
  const dirty = getTabs().filter((t) => t.dirty && t.filePath);
  const results = await Promise.allSettled(
    dirty.map(async (tab) => {
      const text = textOf(tab);
      await writeNote(tab.filePath!, text);
      markSaved(tab.id, text);
    })
  );
  scheduleSessionSave({ immediate: true });
  const failed = dirty.filter((_, i) => results[i].status === 'rejected').map((t) => t.title);
  if (failed.length) showError(`save ${failed.join(', ')}`, 'the changes are kept in the session');
}
