// Screenshot paste (SPEC §6.3): text wins over an image, Ctrl+Shift+V never saves an image.
import { EditorView } from '@codemirror/view';
import { saveImage } from '../ipc';
import { scheduleSessionSave } from '../session';
import { showError } from '../infobar';
import { applyToTab, filePathFor, getState, tabIdFacet } from './registry';
import { primeAssetCache } from './imageWidget';

/** T5. Puts `![snip](link)` on its own line below the line holding `at` (default: the cursor), in any tab. */
export function insertSnip(tabId: string, link: string, at?: number): void {
  const state = getState(tabId);
  if (!state) return;
  const doc = state.doc;
  const line = doc.lineAt(Math.min(at ?? state.selection.main.head, doc.length));
  const snip = `![snip](${link})`;
  const empty = line.length === 0;
  const from = empty ? line.from : line.to;
  let insert = empty ? snip : `\n${snip}`;
  let anchor = from + insert.length + 1;
  if (line.to >= doc.length) {
    insert += '\n';
    anchor = from + insert.length;
  }
  applyToTab(tabId, { changes: { from, to: line.to, insert }, selection: { anchor }, scrollIntoView: true });
}

async function pasteImage(tabId: string, file: File): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await saveImage(tabId, filePathFor(tabId), bytes);
    primeAssetCache(tabId, saved.link, saved.absPath);
    insertSnip(tabId, saved.link);
    scheduleSessionSave({ immediate: true });
  } catch (err) {
    showError('save the image', err);
  }
}

export function pasteExtension() {
  let plainPaste = false;
  return EditorView.domEventHandlers({
    keydown(event) {
      plainPaste = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v';
      return false;
    },
    paste(event, view) {
      const plain = plainPaste;
      plainPaste = false;
      const data = event.clipboardData;
      if (plain || !data || data.getData('text/plain') !== '') return false;
      const item = Array.from(data.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (!file) return false;
      event.preventDefault();
      void pasteImage(view.state.facet(tabIdFacet), file);
      return true;
    }
  });
}
