// Read-mode task clicks (SPEC §5): maps a clicked checkbox back to its `[ ]` / `[x]` in the note.
import { ensureSyntaxTree } from '@codemirror/language';
import type { ChangeSpec, EditorState } from '@codemirror/state';

/**
 * The one-character change that flips task number `index` (document order) to `checked`, or null when the
 * note no longer matches what was rendered: the tree cannot complete, the task count differs from
 * `rendered`, or that marker does not hold the state the box had before the click (`!checked`).
 * Markers inside code are not task markers in the Markdown tree, so they are never counted.
 */
export function taskChange(state: EditorState, index: number, rendered: number, checked: boolean): ChangeSpec | null {
  const tree = ensureSyntaxTree(state, state.doc.length, 5000);
  if (!tree) return null;
  const markers: number[] = [];
  tree.iterate({
    enter: (node) => {
      if (node.name === 'TaskMarker') markers.push(node.from);
    }
  });
  if (markers.length !== rendered || index < 0 || index >= markers.length) return null;
  const from = markers[index];
  const mark = state.sliceDoc(from, from + 3);
  const isDone = /^\[[xX]\]$/.test(mark);
  if (mark !== '[ ]' && !isDone) return null;
  if (isDone !== !checked) return null;
  return { from: from + 1, to: from + 2, insert: checked ? 'x' : ' ' };
}
