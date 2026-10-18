import { EditorState, Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  highlightActiveLine,
  drawSelection,
  dropCursor
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { imageWidgetField } from './imageWidget';
import { createPasteInterceptor } from './pasteHandler';

const snipMdHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4],
    color: 'var(--syn-h)',
    fontWeight: '700'
  },
  {
    tag: [tags.monospace, tags.processingInstruction],
    color: 'var(--syn-code)',
    backgroundColor: 'var(--bg-code-inline)',
    borderRadius: '3px'
  },
  {
    tag: [tags.link, tags.url],
    color: 'var(--syn-img)'
  },
  {
    tag: tags.strong,
    color: 'var(--text-heading)',
    fontWeight: '700'
  },
  {
    tag: tags.emphasis,
    color: 'var(--text-main)',
    fontStyle: 'italic'
  },
  {
    tag: tags.quote,
    color: 'var(--syn-quote)',
    fontStyle: 'italic'
  },
  {
    tag: [tags.meta, tags.comment, tags.punctuation],
    color: 'var(--text-muted)'
  }
]);

export interface CreateEditorOptions {
  initialContent: string;
  getCurrentFilePath: () => string | null;
  onContentChange: (newContent: string) => void;
  onSnipInserted?: () => void;
}

export function createEditorState(options: CreateEditorOptions): EditorState {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    EditorView.lineWrapping,
    markdown(),
    syntaxHighlighting(snipMdHighlightStyle),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    createPasteInterceptor(options.getCurrentFilePath, options.onSnipInserted),
    imageWidgetField,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onContentChange(update.state.doc.toString());
      }
    })
  ];

  return EditorState.create({
    doc: options.initialContent,
    extensions
  });
}
