// Lists and quotes (SPEC §5): Enter, Backspace and Tab follow the Markdown structure, and an ordered
// list stays numbered in sequence after any edit that adds or removes lines.
import { EditorState, type ChangeSpec, type Extension, type StateCommand, type Text } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { deleteMarkupBackward, insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown';
import type { SyntaxNode } from '@lezer/common';

/** A line that is only one level of block markup: `> `, `- `, `- [ ] `, `3. `. */
const ONLY_MARKUP = /^(>|[-+*]( \[[ xX]\])?|\d+[.)]) ?\s*$/;
const ITEM_MARKUP = /^\s*(\d+[.)]|[-+*]( \[[ xX]\])?)\s*$/;
const NUMBER = /^(\d+)(?=[.)])/;

/** The block nodes (`ListItem`, `Blockquote`) around `pos`, innermost first; none inside code. */
function blocksAt(state: EditorState, pos: number): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (n.name === 'FencedCode' || n.name === 'CodeBlock') return [];
    if (n.name === 'ListItem' || n.name === 'Blockquote') found.push(n);
  }
  return found;
}

/** Enter on a line that holds only outer-level markup, with nothing below it, ends the list or quote
 *  with a blank line: what is typed next is a new paragraph, not a lazy continuation of the block. */
const endBlock: StateCommand = ({ state, dispatch }) => {
  const sel = state.selection.main;
  if (state.selection.ranges.length > 1 || !sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to || !ONLY_MARKUP.test(line.text)) return false;
  const blocks = blocksAt(state, sel.head);
  if (blocks.length !== 1) return false; // nested markup goes one level up instead (below)
  if (line.number < state.doc.lines && state.doc.line(line.number + 1).text.trim() !== '') return false;
  const from = line.from;
  dispatch(state.update({
    changes: { from, to: line.to, insert: state.lineBreak },
    selection: { anchor: from + state.lineBreak.length },
    scrollIntoView: true,
    userEvent: 'input'
  }));
  return true;
};

/** Enter on an empty nested item moves it one level up, without the blank line that would split the
 *  list in two; everything else is CodeMirror's continuation of lists and quotes. */
const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

/** Backspace right after the marker of an empty item clears the whole line, indentation included,
 *  so a second Backspace joins the previous line. */
const clearEmptyItem: StateCommand = ({ state, dispatch }) => {
  const sel = state.selection.main;
  if (state.selection.ranges.length > 1 || !sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to || !ITEM_MARKUP.test(line.text)) return false;
  if (!blocksAt(state, sel.head).some((n) => n.name === 'ListItem')) return false;
  dispatch(state.update({ changes: { from: line.from, to: line.to }, scrollIntoView: true, userEvent: 'delete' }));
  return true;
};

/** The item whose marker starts the line at `pos`. */
function itemOnLine(state: EditorState, pos: number): SyntaxNode | null {
  const line = state.doc.lineAt(pos);
  const start = line.from + (/^\s*/.exec(line.text)![0].length);
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(start, 1); n; n = n.parent) {
    if (n.name === 'FencedCode' || n.name === 'CodeBlock') return null;
    if (n.name === 'ListItem' && n.from === start) return n;
  }
  return null;
}

const column = (doc: Text, pos: number): number => pos - doc.lineAt(pos).from;

/** Where an item's text starts: after the marker and its spaces (one space when there are five or
 *  more, as CommonMark reads it). Nested items need this indent to belong to the item. */
function contentColumn(doc: Text, item: SyntaxNode): number {
  const m = /^(\d+[.)]|[-+*])( *)/.exec(doc.sliceString(item.from, doc.lineAt(item.from).to))!;
  const spaces = m[2].length;
  return column(doc, item.from) + m[1].length + (spaces === 0 || spaces >= 5 ? 1 : spaces);
}

const numberOf = (doc: Text, item: SyntaxNode): number | null => {
  const m = NUMBER.exec(doc.sliceString(item.from, item.from + 12));
  return m ? +m[1] : null;
};

/** The change that gives an ordered item the number `n`. */
function setNumber(doc: Text, item: SyntaxNode, n: number): ChangeSpec[] {
  const m = NUMBER.exec(doc.sliceString(item.from, item.from + 12));
  return m && +m[1] !== n ? [{ from: item.from, to: item.from + m[1].length, insert: String(n) }] : [];
}

/** Shifts the lines from the item at the selection start to the end of the item at its end by
 *  `delta` columns (spaces added, or removed where there are any). */
function shiftLines(state: EditorState, first: SyntaxNode, delta: number): ChangeSpec[] {
  const { doc } = state;
  const sel = state.selection.main;
  const last = itemOnLine(state, sel.to) ?? first;
  const end = Math.max(first.to, last.to, sel.to);
  const changes: ChangeSpec[] = [];
  for (let n = doc.lineAt(first.from).number; n <= doc.lineAt(end).number; n++) {
    const line = doc.line(n);
    if (line.text.trim() === '') continue;
    if (delta > 0) changes.push({ from: line.from, insert: ' '.repeat(delta) });
    else changes.push({ from: line.from, to: line.from + Math.min(-delta, /^ */.exec(line.text)![0].length) });
  }
  return changes;
}

/** Tab on a list item nests it (and the items selected with it) under the item above, indented to
 *  that item's text. A nested ordered list starts at 1, or continues the one already there. */
const nestItems: StateCommand = ({ state, dispatch }) => {
  if (state.selection.ranges.length > 1) return false;
  const first = itemOnLine(state, state.selection.main.from);
  if (!first) return false;
  const prev = first.prevSibling;
  if (prev?.name !== 'ListItem') return true; // the first item has nothing to nest under
  const delta = contentColumn(state.doc, prev) - column(state.doc, first.from);
  if (delta <= 0) return true;
  const changes = shiftLines(state, first, delta);
  if (first.parent?.name === 'OrderedList') {
    const sub = prev.lastChild?.name === 'OrderedList' ? prev.lastChild.lastChild : null;
    changes.push(...setNumber(state.doc, first, sub ? (numberOf(state.doc, sub) ?? 0) + 1 : 1));
  }
  dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input.indent' }));
  return true;
};

/** Shift+Tab on a nested item moves it to the level of its parent item, numbered after it. */
const unnestItems: StateCommand = ({ state, dispatch }) => {
  if (state.selection.ranges.length > 1) return false;
  const first = itemOnLine(state, state.selection.main.from);
  const parent = first?.parent?.parent;
  if (!first || parent?.name !== 'ListItem') return false;
  const delta = column(state.doc, parent.from) - column(state.doc, first.from);
  if (delta >= 0) return true;
  const changes = shiftLines(state, first, delta);
  const parentNumber = numberOf(state.doc, parent);
  if (first.parent?.name === 'OrderedList' && parentNumber !== null) changes.push(...setNumber(state.doc, first, parentNumber + 1));
  dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input.indent' }));
  return true;
};

/** Numbers an ordered list's items in sequence from its first number. A list whose items all carry
 *  the same number (`1.` on every line) is numbered that way on purpose and left alone. */
function renumber(list: SyntaxNode, doc: Text, changes: ChangeSpec[]): void {
  const items = list.getChildren('ListItem');
  const nums = items.map((it) => numberOf(doc, it));
  if (nums.some((n) => n === null) || nums.every((n) => n === nums[0])) return;
  items.forEach((it, i) => changes.push(...setNumber(doc, it, nums[0]! + i)));
}

/** After an edit that adds or removes lines, or nests an item, the ordered lists around each change
 *  are renumbered in the same transaction, so one undo takes back both. Edits inside a line leave
 *  numbers alone: a number the user types is theirs. */
const renumberLists = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('move'))) return tr;
  let lines = tr.isUserEvent('input.indent');
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (!lines && (inserted.lines > 1 || tr.startState.doc.sliceString(fromA, toA).includes('\n'))) lines = true;
  });
  if (!lines) return tr;
  const state = tr.state;
  const lists = new Map<number, SyntaxNode>();
  tr.changes.iterChangedRanges((_fA, _tA, fromB, toB) => {
    for (const pos of [fromB, toB]) {
      for (const side of [-1, 1] as const) {
        for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); n; n = n.parent) {
          if (n.name === 'OrderedList') lists.set(n.from, n);
        }
      }
    }
  });
  const changes: ChangeSpec[] = [];
  for (const list of lists.values()) renumber(list, state.doc, changes);
  return changes.length ? [tr, { changes, sequential: true }] : tr;
});

export function listExtension(): Extension {
  return [
    renumberLists,
    keymap.of([
      { key: 'Enter', run: (v) => endBlock(v) || continueMarkup(v) },
      { key: 'Backspace', run: (v) => clearEmptyItem(v) || deleteMarkupBackward(v) },
      { key: 'Tab', run: nestItems, shift: unnestItems }
    ])
  ];
}
