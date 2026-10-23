import { describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { ensureSyntaxTree } from '@codemirror/language';
import { codeParser, highlightCode } from './codeLanguages';
import { createEditorState } from './setup';

describe('code languages', () => {
  it('gives null and an untouched target for an unknown name', async () => {
    const target = document.createElement('code');
    target.textContent = 'keep';
    expect(codeParser('klingon')).toBeNull();
    await highlightCode(target, 'x', 'klingon');
    expect(target.textContent).toBe('keep');
  });

  it('knows the aliases and the first word of a fence, and leaves names off the list plain (SPEC §5)', () => {
    for (const info of ['py', 'rs', 'sh', 'yml', 'tsx', 'htm', 'javascript', 'js title=x']) expect(codeParser(info), info).not.toBeNull();
    for (const info of ['scss', 'jsonc', 'sqlite', 'postcss']) expect(codeParser(info), info).toBeNull();
  });

  it('highlights read-mode code with tok classes and keeps the text', async () => {
    const target = document.createElement('code');
    await highlightCode(target, 'const x = 1', 'js');
    const kw = target.querySelector('.tok-keyword');
    expect(kw?.textContent).toBe('const');
    expect(target.textContent).toBe('const x = 1');
    expect(target.querySelector('script, img')).toBeNull();
  });

  it('highlights a shell block through StreamLanguage', async () => {
    const target = document.createElement('code');
    await highlightCode(target, 'echo "hi" # note\nls', 'bash');
    expect(target.textContent).toBe('echo "hi" # note\nls');
    expect(target.querySelector('.tok-string')).not.toBeNull();
  });

  it('colours a js block in the editor once the language has loaded', async () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({ state: createEditorState('t', '```js\nconst x = 1\n```\n'), parent });
    await vi.waitFor(() => {
      ensureSyntaxTree(view.state, view.state.doc.length, 1e9);
      expect(view.dom.querySelector('.md-code-line .tok-keyword')?.textContent).toBe('const');
    });
    view.destroy();
    parent.remove();
  });
});
