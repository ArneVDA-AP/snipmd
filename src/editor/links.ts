// Rewrites image links of a tab after its images moved (first save, Save As).
import { ensureSyntaxTree } from '@codemirror/language';
import type { ChangeSpec } from '@codemirror/state';
import type { PrefixMove } from '../types';
import { applyToTab, getState } from './registry';

/**
 * Replaces the prefix `move.from` by `move.to` in every Markdown image URL that starts with it, in
 * one transaction (one undo step). Works on hidden tabs too. Returns the number of links changed.
 */
export function rewriteImagePrefix(tabId: string, move: PrefixMove): number {
  const state = getState(tabId);
  if (!state || !move.from) return 0;
  const tree = ensureSyntaxTree(state, state.doc.length, 1000);
  if (!tree) return 0;
  const changes: ChangeSpec[] = [];
  tree.iterate({
    enter(node) {
      if (node.name !== 'Image') return;
      const url = node.node.getChild('URL');
      if (url && state.doc.sliceString(url.from, url.to).startsWith(move.from)) {
        changes.push({ from: url.from, to: url.from + move.from.length, insert: move.to });
      }
      return false;
    }
  });
  if (changes.length > 0) applyToTab(tabId, { changes, userEvent: 'input.rewritelinks' });
  return changes.length;
}
