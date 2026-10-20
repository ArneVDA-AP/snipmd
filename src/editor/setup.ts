import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { imageWidgetField } from './imageWidget';
import { pasteExtension } from './paste';
import { notifyChange, tabIdFacet } from './registry';

const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.45em', fontWeight: '600', color: 'var(--text-strong)' },
  { tag: tags.heading2, fontSize: '1.25em', fontWeight: '600', color: 'var(--text-strong)' },
  { tag: [tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--text-strong)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--code)' },
  { tag: [tags.link, tags.url], color: 'var(--accent)' },
  { tag: tags.quote, color: 'var(--text-dim)' },
  { tag: [tags.processingInstruction, tags.meta, tags.punctuation], color: 'var(--text-dim)' }
]);

export function createEditorState(tabId: string, doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      tabIdFacet.of(tabId),
      history(),
      drawSelection(),
      dropCursor(),
      highlightActiveLine(),
      EditorView.lineWrapping,
      markdown(),
      syntaxHighlighting(highlight),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      pasteExtension(),
      imageWidgetField,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) notifyChange(tabId, u.state.doc.toString());
      })
    ]
  });
}
