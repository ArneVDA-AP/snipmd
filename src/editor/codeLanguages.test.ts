import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { ensureSyntaxTree, LanguageDescription } from '@codemirror/language';
import { CODE_LANGUAGES, codeParser, highlightCode } from './codeLanguages';
import { createEditorState } from './setup';

describe('code languages', () => {
  it('gives null and an untouched target for an unknown name', async () => {
    const target = document.createElement('code');
    target.textContent = 'keep';
    expect(codeParser('klingon')).toBeNull();
    expect(await highlightCode(target, 'x', 'klingon')).toBe(false);
    expect(target.textContent).toBe('keep');
  });

  it('resolves the aliases', () => {
    const name = (n: string) => LanguageDescription.matchLanguageName(CODE_LANGUAGES, n, true)?.name;
    expect([name('py'), name('rs'), name('sh'), name('yml'), name('tsx'), name('htm')]).toEqual(['Python', 'Rust', 'Shell', 'YAML', 'TypeScript', 'HTML']);
  });

  it('highlights read-mode code with tok classes and keeps the text', async () => {
    const target = document.createElement('code');
    expect(await highlightCode(target, 'const x = 1', 'js')).toBe(true);
    const kw = target.querySelector('.tok-keyword');
    expect(kw?.textContent).toBe('const');
    expect(target.textContent).toBe('const x = 1');
    expect(target.querySelector('script, img')).toBeNull();
  });

  it('highlights a shell block through StreamLanguage', async () => {
    const target = document.createElement('code');
    expect(await highlightCode(target, 'echo "hi" # note\nls', 'bash')).toBe(true);
    expect(target.textContent).toBe('echo "hi" # note\nls');
    expect(target.querySelector('.tok-string')).not.toBeNull();
  });

  it('colours a js block in the editor once the language has loaded', async () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({ state: createEditorState('t', '```js\nconst x = 1\n```\n'), parent });
    ensureSyntaxTree(view.state, view.state.doc.length, 1e9);
    await LanguageDescription.matchLanguageName(CODE_LANGUAGES, 'js', true)!.load();
    await new Promise((r) => setTimeout(r, 50));
    ensureSyntaxTree(view.state, view.state.doc.length, 1e9);
    view.dispatch({ changes: { from: view.state.doc.length, insert: ' ' } });
    ensureSyntaxTree(view.state, view.state.doc.length, 1e9);
    await new Promise((r) => setTimeout(r, 50));
    expect(view.dom.querySelector('.md-code-line .tok-keyword')?.textContent).toBe('const');
    view.destroy();
    parent.remove();
  });
});
