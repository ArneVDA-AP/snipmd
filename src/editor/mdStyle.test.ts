import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdownLines } from './mdStyle';

function classesOf(doc: string): string[] {
  const state = EditorState.create({ doc, extensions: [markdown(), markdownLines] });
  ensureSyntaxTree(state, state.doc.length, 1000);
  const view = new EditorView({ state, parent: document.body });
  const out = [...view.contentDOM.querySelectorAll('.cm-line')].map((l) =>
    [...l.classList].filter((c) => c.startsWith('md-')).join(' ')
  );
  view.destroy();
  return out;
}

describe('markdown line styling', () => {
  it('marks fenced code lines with first and last, and nothing around them', () => {
    expect(classesOf('text\n```\na\nb\n```\nafter')).toEqual([
      '',
      'md-code-line md-code-first',
      'md-code-line',
      'md-code-line',
      'md-code-line md-code-last',
      ''
    ]);
  });

  it('turns spellcheck off on code lines only, the fence and its language name included', () => {
    const state = EditorState.create({ doc: 'prose\n```js\nconst x = 1;\n```', extensions: [markdown(), markdownLines] });
    ensureSyntaxTree(state, state.doc.length, 1000);
    const view = new EditorView({ state, parent: document.body });
    const checks = [...view.contentDOM.querySelectorAll('.cm-line')].map((l) => l.getAttribute('spellcheck'));
    view.destroy();
    expect(checks).toEqual([null, 'false', 'false', 'false']);
  });

  it('marks quote lines', () => {
    expect(classesOf('> one\n> two\n\nplain')).toEqual(['md-quote-line', 'md-quote-line', '', '']);
  });
});
