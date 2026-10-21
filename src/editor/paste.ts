// Screenshot paste (SPEC §6.3): text wins over an image, Ctrl+Shift+V never saves an image.
import { EditorView } from '@codemirror/view';
import { saveImage } from '../ipc';
import type { SavedImage } from '../types';
import { scheduleSessionSave } from '../session';
import { showError } from '../infobar';
import { applyToTab, filePathFor, getState, tabIdFacet, trackImageSave } from './registry';
import { primeAssetCache } from './imageWidget';
import { markPasteVisible } from '../perf';
import { IS_MAC } from '../platform';

/** One `![snip](link)` line per link, as one block below the line holding `at` (default: the cursor), in one transaction. */
function insertLinks(tabId: string, links: string[], at?: number): void {
  const state = getState(tabId);
  if (!state) return;
  const doc = state.doc;
  const line = doc.lineAt(Math.min(at ?? state.selection.main.head, doc.length));
  const block = links.map((l) => `![snip](${l})`).join('\n');
  const from = line.length === 0 ? line.from : line.to;
  let insert = line.length === 0 ? block : `\n${block}`;
  const end = from + insert.length;
  // The cursor goes to an empty line below the images (SPEC §2): the next line when it is empty,
  // otherwise a new one, so typing never joins the text that follows.
  if (line.to >= doc.length || doc.lineAt(line.to + 1).length > 0) insert += '\n';
  applyToTab(tabId, { changes: { from, to: line.to, insert }, selection: { anchor: end + 1 }, scrollIntoView: true });
}

/**
 * The one way saved images land in a tab (paste and drop): shown from the cache at once, linked on
 * their own lines below `at` or the cursor, and the session written immediately (SPEC §7).
 */
export function placeImages(tabId: string, images: SavedImage[], at?: number): void {
  if (images.length === 0) return;
  for (const i of images) primeAssetCache(tabId, i.link, i.absPath);
  insertLinks(tabId, images.map((i) => i.link), at);
  scheduleSessionSave({ immediate: true });
}

async function pasteImage(tabId: string, file: File, start: number): Promise<void> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await saveImage(tabId, filePathFor(tabId), bytes);
    placeImages(tabId, [saved]);
    markPasteVisible(saved.absPath, start);
  } catch (err) {
    showError('save the image', err);
  }
}

export function pasteExtension() {
  let plainPaste = false;
  return EditorView.domEventHandlers({
    keydown(event) {
      // On macOS this key never ends in a paste event (pastePlainText does it), so the flag would
      // linger and make the next paste from the menu skip its image.
      plainPaste = !IS_MAC && (event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyV';
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
      const tabId = view.state.facet(tabIdFacet);
      void trackImageSave(tabId, pasteImage(tabId, file, event.timeStamp));
      return true;
    }
  });
}

/**
 * macOS Paste as Plain Text (SPEC §13): Rust read the clipboard's text, and it goes where the
 * cursor is, as Ctrl+Shift+V does on Windows: the note, or a field such as Find.
 */
export function pastePlainText(view: EditorView | null, text: string): void {
  const at = document.activeElement;
  if (at instanceof HTMLInputElement || at instanceof HTMLTextAreaElement) {
    document.execCommand('insertText', false, text);
  } else if (view && at === view.contentDOM) {
    view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true });
  }
}
