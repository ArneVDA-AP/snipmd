import { describe, expect, it } from 'vitest';
import { EditorView, runScopeHandlers } from '/home/user/snipmd/node_modules/@codemirror/view/dist/index.js';
import { EditorSelection } from '/home/user/snipmd/node_modules/@codemirror/state/dist/index.js';
import { ensureSyntaxTree, LanguageDescription } from '/home/user/snipmd/node_modules/@codemirror/language/dist/index.js';
import { createEditorState } from '/home/user/snipmd/src/editor/setup';
import { CODE_LANGUAGES } from '/home/user/snipmd/src/editor/codeLanguages';
const shown = (v: EditorView) => { const s = v.state.doc.toString(); const h = v.state.selection.main.head; return s.slice(0, h) + '|' + s.slice(h); };
function run(doc: string, key: string, shiftKey = false) {
  const at = doc.indexOf('|');
  const parent = document.createElement('div'); document.body.append(parent);
  const st = createEditorState('t', doc.replace('|', ''));
  const v = new EditorView({ state: st.update({ selection: EditorSelection.cursor(at) }).state, parent });
  ensureSyntaxTree(v.state, v.state.doc.length, 1e9);
  runScopeHandlers(v, new KeyboardEvent('keydown', { key, shiftKey }), 'editor');
  const out = shown(v); v.destroy(); parent.remove(); return out;
}
describe('probe: list keys on createEditorState', () => {
  it('runs', async () => {
    await LanguageDescription.matchLanguageName(CODE_LANGUAGES, 'js', true)!.load();
    console.log(JSON.stringify(run('- a|', 'Enter')));
    console.log(JSON.stringify(run('1. a\n2. b|', 'Enter')));
    console.log(JSON.stringify(run('- a\n- |', 'Tab')));
    console.log(JSON.stringify(run('- a\n\n  ```js\n  const x = 1|\n  ```', 'Enter')));
    console.log(JSON.stringify(run('> q|', 'Enter')));
    expect(1).toBe(1);
  });
});
