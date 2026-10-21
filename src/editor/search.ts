// Find and replace (SPEC §5, §10): CodeMirror's search panel at the top, with Ctrl+H opening it on
// the replace field and labels written the way the rest of the app writes them.
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { openSearchPanel, search, searchKeymap } from '@codemirror/search';

/** Opens the panel and focuses its find field, or its replace field for Ctrl+H. */
export function openFind(view: EditorView, replace: boolean): boolean {
  openSearchPanel(view);
  if (replace) {
    const field = view.dom.querySelector<HTMLInputElement>('.cm-search input[name=replace]');
    field?.focus();
    field?.select();
  }
  return true;
}

const PHRASES = {
  Find: 'Find',
  Replace: 'Replace',
  next: 'Next',
  previous: 'Previous',
  all: 'All',
  'match case': 'Match case',
  regexp: 'Regex',
  'by word': 'Whole word',
  replace: 'Replace',
  'replace all': 'Replace all',
  close: 'Close (Esc)',
  'current match': 'current match',
  'replaced match on line $': 'replaced match on line $',
  'replaced $ matches': 'replaced $ matches',
  'on line': 'on line'
};

export function findExtension(): Extension {
  return [
    search({ top: true }),
    EditorState.phrases.of(PHRASES),
    keymap.of([{ key: 'Mod-h', run: (v) => openFind(v, true), preventDefault: true, scope: 'editor search-panel' }, ...searchKeymap])
  ];
}
