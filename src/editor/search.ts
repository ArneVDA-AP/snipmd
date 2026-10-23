// Find and replace (SPEC §5, §10): CodeMirror's search panel at the top, with Ctrl+H going to the
// replace field once there is something to find, and labels written the way the rest of the app
// writes them.
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { openSearchPanel, search, searchKeymap, searchPanelOpen } from '@codemirror/search';
import { plainField } from '../dom';

/** Opens the panel on its find field. Ctrl+H goes on to the replace field when the find field
 *  already holds a term (from the selection or an earlier search); with nothing to find, typing
 *  starts in the find field, as in Notepad and VS Code. */
export function openFind(view: EditorView, replace: boolean): boolean {
  openSearchPanel(view);
  const find = view.dom.querySelector<HTMLInputElement>('.cm-search input[name=search]');
  const field = replace && find?.value ? view.dom.querySelector<HTMLInputElement>('.cm-search input[name=replace]') : find;
  field?.focus();
  field?.select();
  return true;
}

/** A click on a button or checkbox keeps the focus in the field. WebKit (macOS) gives a clicked
 *  button no focus, so the focus would fall out of the panel and Escape would no longer close it. */
function keepFocus(panel: HTMLElement): void {
  panel.addEventListener('mousedown', (e) => {
    if ((e.target as Element).closest('button, label, input[type=checkbox]')) e.preventDefault();
  });
}

const panelSetup = EditorView.updateListener.of((u) => {
  if (!searchPanelOpen(u.state) || searchPanelOpen(u.startState)) return;
  const panel = u.view.dom.querySelector<HTMLElement>('.cm-search');
  if (!panel) return;
  panel.querySelectorAll<HTMLInputElement>('input').forEach(plainField);
  keepFocus(panel);
});

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
  close: 'Close (Esc)'
};

export function findExtension(): Extension {
  return [
    search({ top: true }),
    panelSetup,
    EditorState.phrases.of(PHRASES),
    // Replace is Cmd+Option+F on macOS, where Cmd+H hides the app (SPEC §13).
    keymap.of([{ key: 'Mod-h', mac: 'Mod-Alt-f', run: (v) => openFind(v, true), preventDefault: true, scope: 'editor search-panel' }, ...searchKeymap])
  ];
}
