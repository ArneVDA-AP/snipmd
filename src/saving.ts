// Saving notes. Phase 4 adds autosave, the first-save info bar and Save As.
import { pickSavePath, promoteScratchAssets, writeNote } from './ipc';
import { getTab, getTabs, markSaved, setLastFolder, untitledContentsExcept } from './tabs';
import { scheduleSessionSave } from './session';
import { showInfo } from './infobar';

const dirname = (p: string): string => p.slice(0, Math.max(0, p.lastIndexOf('/')));

/** Ctrl+S. Disk tab: write. Untitled tab: ask for a path, move its images, write. */
export async function saveTab(id: string): Promise<boolean> {
  const tab = getTab(id);
  if (!tab) return false;
  const text = tab.content;
  try {
    if (tab.filePath) {
      await writeNote(tab.filePath, text);
      markSaved(id, text);
    } else {
      const picked = await pickSavePath(tab.title);
      if (!picked) return false;
      const target = picked.replace(/\\/g, '/');
      await promoteScratchAssets(text, target, untitledContentsExcept(id));
      await writeNote(target, text);
      markSaved(id, text, target);
      setLastFolder(dirname(target));
    }
  } catch (err) {
    showInfo({ kind: 'error', text: `Could not save ${tab.title}: ${String(err)}` });
    return false;
  }
  scheduleSessionSave({ immediate: true });
  return true;
}

/** Window blur and close: write every dirty disk tab. One failure never stops the others or the session save. */
export async function flushDirty(): Promise<void> {
  const failed: string[] = [];
  for (const tab of getTabs()) {
    if (!tab.dirty || !tab.filePath) continue;
    const text = tab.content;
    try {
      await writeNote(tab.filePath, text);
      markSaved(tab.id, text);
    } catch {
      failed.push(tab.title);
    }
  }
  scheduleSessionSave({ immediate: true });
  if (failed.length) {
    showInfo({ kind: 'error', text: `Could not save ${failed.join(', ')}. The changes are kept in the session.` });
  }
}
