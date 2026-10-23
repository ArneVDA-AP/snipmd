import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, drawSelection, dropCursor } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdownLanguage, pasteURLAsLink } from '@codemirror/lang-markdown';
import { HighlightStyle, Language, LanguageSupport, syntaxHighlighting } from '@codemirror/language';
import { classHighlighter, tags } from '@lezer/highlight';
import { parseCode, type MarkdownParser } from '@lezer/markdown';
import { imageWidgetField } from './imageWidget';
import { pasteExtension } from './paste';
import { notifyChange, tabIdFacet } from './registry';
import { findExtension } from './search';
import { markdownLines } from './mdStyle';
import { emptyHint } from './emptyHint';
import { listExtension } from './lists';
import { codeParser } from './codeLanguages';

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

/**
 * GitHub-flavoured Markdown without embedded HTML: `markdown()` would pull in the HTML parser and
 * autocompletion (SPEC §9). Fenced code is parsed by languages that load on first use. The language
 * shares markdownLanguage.data: CodeMirror's list commands ask `markdownLanguage.isActiveAt`, which compares that
 * facet, and a Language with other data would switch the list keys off.
 * Enter, Backspace and Tab follow lists and quotes; pasting a URL over a selection makes a link.
 */
const markdownWithCode = new Language(markdownLanguage.data, (markdownLanguage.parser as MarkdownParser).configure(parseCode({ codeParser })), [], 'markdown');
const markdownSupport = new LanguageSupport(markdownWithCode, [Prec.high(listExtension()), pasteURLAsLink]);

/**
 * The style nonce Tauri puts into index.html and the CSP of a release build. CodeMirror injects its
 * styles as <style> tags; without this nonce the CSP blocks them (no Markdown styling on Windows).
 * Undefined in dev, where there is no CSP.
 */
const styleNonce = document.querySelector<HTMLStyleElement>('style[nonce]')?.nonce || undefined;

export function createEditorState(tabId: string, doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      tabIdFacet.of(tabId),
      ...(styleNonce ? [EditorView.cspNonce.of(styleNonce)] : []),
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ spellcheck: 'true', 'aria-label': 'Note' }),
      markdownSupport,
      syntaxHighlighting(highlight),
      syntaxHighlighting(classHighlighter),
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
