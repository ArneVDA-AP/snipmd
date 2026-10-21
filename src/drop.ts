// Files dropped on the window (SPEC §6.3): notes open, images become links in the tab under the drop.
import type { DroppedFiles } from './types';
import { importImage } from './ipc';
import { basename } from './paths';
import { showError } from './infobar';
import { activate, getActiveTab, getTab, openPaths } from './tabs';
import { placeImages } from './editor/paste';
import { filePathFor, getView, trackImageSave } from './editor/registry';

/** Editor position under the drop point (physical pixels), or undefined to use the cursor. */
function dropPosition(tabId: string, d: DroppedFiles): number | undefined {
  if (getTab(tabId)?.mode === 'read') return undefined;
  const dpr = window.devicePixelRatio || 1;
  return getView()?.posAtCoords({ x: d.x / dpr, y: d.y / dpr }) ?? undefined;
}

export async function handleDrop(d: DroppedFiles): Promise<void> {
  try {
    // Read first: opening notes changes the active tab. The active tab, not the editor view: in read
    // mode the hidden view still holds another note.
    const tabId = d.images.length > 0 ? (getActiveTab()?.id ?? null) : null;
    const at = tabId ? dropPosition(tabId, d) : undefined;
    if (d.notes.length > 0) await openPaths(d.notes);
    if (!tabId) return;

    const notePath = filePathFor(tabId);
    const results = await trackImageSave(
      tabId,
      Promise.allSettled(d.images.map((src) => importImage(tabId, notePath, src))).then((r) => {
        placeImages(tabId, r.flatMap((x) => (x.status === 'fulfilled' ? [x.value] : [])), at);
        return r;
      })
    );
    // A tab in read mode shows its new images at once.
    if (getTab(tabId)?.mode === 'read' && getActiveTab()?.id === tabId) await activate(tabId);
    const failed = d.images.filter((_, i) => results[i].status === 'rejected');
    const reason = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
    if (failed.length > 0) showError(`add ${failed.map(basename).join(', ')}`, reason);
  } catch (err) {
    showError('handle the dropped files', err);
  }
}
