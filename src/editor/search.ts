// Find and replace (SPEC §5, §10): CodeMirror's search panel at the top, with Ctrl+H going to the
// replace field once there is something to find, and labels written the way the rest of the app
// writes them.
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view';
import { getSearchQuery, openSearchPanel, search, searchKeymap, searchPanelOpen } from '@codemirror/search';
import { plainField } from '../dom';
import { getSetting } from '../settings';

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
  if (getSetting('findCount')) addCountSpan(panel);
});

const COUNT_CAP = 1000;

/** The text for the count span: 'N of M' when the main selection is a match, 'M matches', 'No matches',
 *  or empty for an empty or invalid query. Stops after COUNT_CAP matches. */
export function countText(state: EditorState): string {
  const query = getSearchQuery(state);
  if (!query.valid) return '';
  const { from, to } = state.selection.main;
  let total = 0;
  let current = 0;
  const cursor = query.getCursor(state);
  for (let r = cursor.next(); !r.done; r = cursor.next()) {
    const m = r.value;
    total++;
    if (!current && m.from === from && m.to === to) current = total;
    if (total > COUNT_CAP) break;
  }
  if (!total) return 'No matches';
  const capped = total > COUNT_CAP;
  const m = capped ? `${COUNT_CAP}+` : String(total);
  if (current && current <= COUNT_CAP) return `${current} of ${m}`;
  return `${m} matches`;
}

const idle = (fn: () => void): (() => void) => {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(fn);
    return () => cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 100);
  return () => clearTimeout(id);
};

/** Counts matches while the panel is open, never inside the update itself (SPEC §5). */
const matchCount = ViewPlugin.fromClass(
  class {
    cancel: (() => void) | null = null;
    constructor(readonly view: EditorView) {}
    update(u: ViewUpdate): void {
      if (!searchPanelOpen(u.state)) return;
      const opened = !searchPanelOpen(u.startState);
      const changed = opened || u.docChanged || u.selectionSet || !getSearchQuery(u.state).eq(getSearchQuery(u.startState));
      if (!changed) return;
      this.schedule();
    }
    schedule(): void {
      if (this.cancel) return;
      this.cancel = idle(() => {
        this.cancel = null;
        const span = this.view.dom.querySelector('.cm-search .cm-search-count');
        if (span) span.textContent = countText(this.view.state);
      });
    }
    destroy(): void {
      this.cancel?.();
    }
  }
);

function addCountSpan(panel: Element): void {
  const span = document.createElement('span');
  span.className = 'cm-search-count';
  span.setAttribute('aria-live', 'polite');
  panel.querySelector('input[name=search]')?.after(span);
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
  close: 'Close (Esc)'
};

export function findExtension(): Extension {
  return [
    search({ top: true }),
    panelSetup,
    matchCount,
    EditorState.phrases.of(PHRASES),
    // Replace is Cmd+Option+F on macOS, where Cmd+H hides the app (SPEC §13).
    keymap.of([{ key: 'Mod-h', mac: 'Mod-Alt-f', run: (v) => openFind(v, true), preventDefault: true, scope: 'editor search-panel' }, ...searchKeymap])
  ];
}
