// Holds one CodeMirror EditorState per tab and the single visible EditorView.
// Async work (paste, image resolution) targets a tab id through applyToTab, so it lands in
// the right document even when the user switched tabs meanwhile.
import { EditorState, Facet, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** The tab id an EditorState belongs to. */
export const tabIdFacet = Facet.define<string, string>({
  combine: (values) => values[0] ?? ''
});

const states = new Map<string, EditorState>();
let view: EditorView | null = null;
let filePathLookup: (tabId: string) => string | null = () => null;
let changeListener: (tabId: string) => void = () => {};

export function setView(v: EditorView): void {
  view = v;
}

export function getView(): EditorView | null {
  return view;
}

/** The tab whose state is currently in the visible view, or null. */
export function visibleTabId(): string | null {
  return view ? view.state.facet(tabIdFacet) : null;
}

export function getState(tabId: string): EditorState | undefined {
  if (view && visibleTabId() === tabId) return view.state;
  return states.get(tabId);
}

export function setState(tabId: string, state: EditorState): void {
  states.set(tabId, state);
}

export function dropState(tabId: string): void {
  states.delete(tabId);
}

export function bindFilePathLookup(fn: (tabId: string) => string | null): void {
  filePathLookup = fn;
}

export function filePathFor(tabId: string): string | null {
  return filePathLookup(tabId);
}

export function bindChangeListener(fn: (tabId: string) => void): void {
  changeListener = fn;
}

/** Called on every document change. Cheap on purpose: the text is read only when it is needed (textOf). */
export function notifyChange(tabId: string): void {
  changeListener(tabId);
}

/** Current text of a tab's editor, or undefined when the tab has no editor state yet. */
export function textOf(tabId: string): string | undefined {
  return getState(tabId)?.doc.toString();
}

/** Applies a transaction to a tab's document, whether it is visible or not. Returns false if the tab is gone. */
export function applyToTab(tabId: string, spec: TransactionSpec): boolean {
  if (view && visibleTabId() === tabId) {
    view.dispatch(spec);
    return true;
  }
  const state = states.get(tabId);
  if (!state) return false;
  const tr = state.update(spec);
  states.set(tabId, tr.state);
  if (tr.docChanged) notifyChange(tabId);
  return true;
}
