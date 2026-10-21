import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { imageWidgetField } from './imageWidget';
import { pasteExtension } from './paste';
import { notifyChange, tabIdFacet } from './registry';
import { findExtension } from './search';
import { markdownLines } from './mdStyle';
import { emptyHint } from './emptyHint';

/** Light Markdown styling (SPEC §5): larger headings, dimmed syntax, bold and italic shown. */
const highlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '600', lineHeight: '1.3', color: 'var(--text-strong)', fontFamily: 'var(--font-display)' },
  { tag: tags.heading2, fontSize: '1.3em', fontWeight: '600', lineHeight: '1.35', color: 'var(--text-strong)', fontFamily: 'var(--font-display)' },
  { tag: tags.heading3, fontSize: '1.12em', fontWeight: '600', color: 'var(--text-strong)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--text-strong)' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--text-strong)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-code)', color: 'var(--code)' },
  { tag: tags.link, color: 'var(--link)' },
  { tag: tags.url, color: 'var(--syntax)' },
  { tag: tags.quote, color: 'var(--text-muted)' },
  { tag: tags.contentSeparator, color: 'var(--syntax)' },
  { tag: [tags.processingInstruction, tags.meta, tags.punctuation], color: 'var(--syntax)' }
]);

export function createEditorState(tabId: string, doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      tabIdFacet.of(tabId),
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true', 'aria-label': 'Note' }),
      markdown(),
      syntaxHighlighting(highlight),
      markdownLines,
      emptyHint,
      findExtension(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      pasteExtension(),
      imageWidgetField,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) notifyChange(tabId);
      })
    ]
  });
}
