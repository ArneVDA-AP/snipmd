import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditorState } from './setup';

describe('editor setup', () => {
  it('turns spell check off for the whole note', () => {
    const view = new EditorView({ state: createEditorState('t1', 'een zin in het Nederlands'), parent: document.body });
    const spellcheck = view.contentDOM.getAttribute('spellcheck');
    view.destroy();
    expect(spellcheck).toBe('false');
  });
});
