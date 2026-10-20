// Screenshot paste. Phase 3 adds the SPEC §6.3 rules (text wins, Ctrl+Shift+V).
import { EditorView } from '@codemirror/view';
import { saveImage } from '../ipc';
import { scheduleSessionSave } from '../session';
import { showError } from '../infobar';
import { applyToTab, filePathFor, getState, tabIdFacet } from './registry';
import { primeAssetCache } from './imageWidget';

/** T5. Inserts an image link into the given tab at its cursor, also when the tab is not visible. */
export function insertSnip(tabId: string, link: string): void {
  const state = getState(tabId);
  if (!state) return;
  const { from, to, head } = state.selection.main;
  const prefix = state.doc.lineAt(head).text.trim().length > 0 ? '\n' : '';
  const text = `${prefix}![snip](${link})\n`;
  applyToTab(tabId, {
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true
  });
}

async function pasteImageBytes(tabId: string, bytes: Uint8Array): Promise<void> {
  const notePath = filePathFor(tabId);
  try {
    const saved = await saveImage(tabId, notePath, bytes);
    primeAssetCache(notePath, saved.link, saved.absPath);
    insertSnip(tabId, saved.link);
    scheduleSessionSave({ immediate: true });
  } catch (err) {
    showError('save the image', err);
  }
}

export function pasteExtension() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) return false;
        event.preventDefault();
        const tabId = view.state.facet(tabIdFacet);
        void file.arrayBuffer().then((buf) => pasteImageBytes(tabId, new Uint8Array(buf)));
        return true;
      }
      return false;
    }
  });
}
