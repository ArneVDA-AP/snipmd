// Rewrites image links of a tab after its images moved (first save, Save As).
import { ensureSyntaxTree } from '@codemirror/language';
import type { ChangeSpec, EditorState } from '@codemirror/state';
import type { PrefixMove } from '../types';
import { applyToTab, getState } from './registry';

/** Every Markdown image URL that starts with exactly `move.from`, as a change to `move.to`. */
function prefixChanges(state: EditorState, move: PrefixMove): ChangeSpec[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  const changes: ChangeSpec[] = [];
  tree?.iterate({
    enter(node) {
      if (node.name !== 'Image') return;
      const url = node.node.getChild('URL');
      if (url && state.doc.sliceString(url.from, url.to).startsWith(move.from)) {
        changes.push({ from: url.from, to: url.from + move.from.length, insert: move.to });
      }
      return false;
    }
  });
  return changes;
}

/** The tab's text as it reads after the rewrite, without changing the tab (written to disk first). */
export function rewrittenText(tabId: string, move: PrefixMove): string {
  const state = getState(tabId);
  if (!state) return '';
  return state.update({ changes: prefixChanges(state, move) }).state.doc.toString();
}

/** T12. Applies the rewrite to the tab's current text in one transaction (one undo step). Returns the number of links changed. */
export function rewriteImagePrefix(tabId: string, move: PrefixMove): number {
  const state = getState(tabId);
  if (!state) return 0;
  const changes = prefixChanges(state, move);
  if (changes.length > 0) applyToTab(tabId, { changes, userEvent: 'input.rewritelinks' });
  return changes.length;
}
