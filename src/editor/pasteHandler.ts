import { EditorView } from '@codemirror/view';
import { saveClipboardImage } from '../ipc/bridge';
import { primeAssetCache, assetResolvedEffect } from './imageWidget';

export async function processAndInsertSnipBytes(
  view: EditorView,
  bytes: Uint8Array,
  currentFilePath: string | null,
  onSnipInserted?: () => void
): Promise<void> {
  const result = await saveClipboardImage(bytes, currentFilePath);

  // Pre-populate synchronous cache BEFORE dispatching editor transaction
  primeAssetCache(currentFilePath, result.markdownRelPath, result.absDiskPath);

  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const prefix = line.text.trim().length > 0 ? '\n' : '';
  const markdownSyntax = `${prefix}![snip](${result.markdownRelPath})\n`;

  view.dispatch({
    changes: {
      from: pos,
      to: view.state.selection.main.to,
      insert: markdownSyntax
    },
    selection: { anchor: pos + markdownSyntax.length },
    effects: assetResolvedEffect.of(result.markdownRelPath),
    scrollIntoView: true
  });

  if (onSnipInserted) {
    onSnipInserted();
  }
}

export function createPasteInterceptor(
  getCurrentFilePath: () => string | null,
  onSnipInserted?: () => void
) {
  return EditorView.domEventHandlers({
    paste(event: ClipboardEvent, view: EditorView) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const blob = item.getAsFile();
          if (!blob) return true;

          void blob.arrayBuffer().then((buffer) => {
            const bytes = new Uint8Array(buffer);
            void processAndInsertSnipBytes(
              view,
              bytes,
              getCurrentFilePath(),
              onSnipInserted
            );
          });
          return true;
        }
      }
      return false;
    }
  });
}
