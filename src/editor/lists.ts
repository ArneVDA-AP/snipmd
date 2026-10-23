// Lists and quotes (SPEC §5): Enter, Backspace and Tab follow the Markdown structure, and ordered
// lists stay numbered in sequence after any edit that adds, removes or nests lines.
import { EditorState, type ChangeSpec, type Extension, type StateCommand, type Text, type Transaction } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { deleteMarkupBackward, insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown';
import type { SyntaxNode } from '@lezer/common';

const MARKER = String.raw`(?:\d+[.)]|[-+*](?: \[[ xX]\])?)`;
/** A line that is only one quote mark: `> `. */
const EMPTY_QUOTE = /^> ?\s*$/;
/** A line that is only an item marker, possibly indented: `- `, `  - [ ] `, `3. `. */
const EMPTY_ITEM = new RegExp(String.raw`^\s*${MARKER}\s*$`);
const NUMBER = /^\d+(?=[.)])/;

/** The syntax nodes around `pos`, innermost first; none inside code, where Markdown has no blocks. */
function ancestors(state: EditorState, pos: number, side: -1 | 1): SyntaxNode[] {
  const found: SyntaxNode[] = [];
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side); n; n = n.parent) {
    if (n.name === 'FencedCode' || n.name === 'CodeBlock') return [];
    found.push(n);
  }
  return found;
}

const inBlock = (state: EditorState, pos: number): boolean =>
  ancestors(state, pos, -1).some((n) => n.name === 'ListItem' || n.name === 'Blockquote');

/** The cursor's line when the selection is one cursor at the end of a line matching `re`. */
function markupLine(state: EditorState, re: RegExp) {
  const sel = state.selection;
  if (sel.ranges.length > 1 || !sel.main.empty) return null;
  const line = state.doc.lineAt(sel.main.head);
  return sel.main.head === line.to && re.test(line.text) ? line : null;
}

/** Enter continues lists and quotes. On an empty nested item it moves the item up a level, without
 *  the blank line that would split the list; on an empty quote line it ends the quote. */
const continueMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

const endQuote: StateCommand = ({ state, dispatch }) => {
  const line = markupLine(state, EMPTY_QUOTE);
  if (!line || !inBlock(state, line.to)) return false;
  dispatch(state.update({ changes: { from: line.from, to: line.to }, userEvent: 'input' }));
  return true;
};

/** When Enter leaves the last block, a blank line follows it, so what is typed next is a new
 *  paragraph and not a lazy continuation of the item or quote above. */
const enter: StateCommand = ({ state, dispatch }) => {
  let done: Transaction | null = null;
  if (!endQuote({ state, dispatch: (t) => (done = t) }) && !continueMarkup({ state, dispatch: (t) => (done = t) })) return false;
  const tr = done as Transaction | null;
  if (!tr) return false;
  // An empty line means no markup was carried over: Enter left the block.
  const head = tr.newSelection.main.head;
  const line = tr.newDoc.lineAt(head);
  const above = line.number > 1 ? tr.newDoc.line(line.number - 1) : null;
  const left = line.text === '' && above !== null && above.text.trim() !== '';
  const b = state.lineBreak;
  dispatch(state.update(
    { changes: tr.changes, selection: tr.selection, scrollIntoView: true, userEvent: 'input' },
    ...(left ? [{ changes: { from: head, insert: b }, selection: { anchor: head + b.length }, sequential: true }] : [])
  ));
  return true;
};

/** Backspace right after the marker of an empty item clears the whole line, indentation included,
 *  so a second Backspace joins the previous line. */
const clearEmptyItem: StateCommand = ({ state, dispatch }) => {
  const line = markupLine(state, EMPTY_ITEM);
  if (!line || !ancestors(state, line.to, -1).some((n) => n.name === 'ListItem')) return false;
  dispatch(state.update({ changes: { from: line.from, to: line.to }, scrollIntoView: true, userEvent: 'delete' }));
  return true;
};

/** The item whose marker starts the line at `pos`. */
function itemOnLine(state: EditorState, pos: number): SyntaxNode | null {
  const line = state.doc.lineAt(pos);
  const start = line.from + /^\s*/.exec(line.text)![0].length;
  return ancestors(state, start, 1).find((n) => n.name === 'ListItem' && n.from === start) ?? null;
}

const column = (doc: Text, pos: number): number => pos - doc.lineAt(pos).from;

/** Where an item's text starts: after the marker and its spaces (one space when there are five or
 *  more, as CommonMark reads it). Nested items need this indent to belong to the item. */
function contentColumn(doc: Text, item: SyntaxNode): number {
  const m = /^(\d+[.)]|[-+*])( *)/.exec(doc.sliceString(item.from, doc.lineAt(item.from).to))!;
  const spaces = m[2].length;
  return column(doc, item.from) + m[1].length + (spaces === 0 || spaces >= 5 ? 1 : spaces);
}

/** Tab nests the selected items under the item above, indented to its text; Shift+Tab moves them
 *  to their parent item's level. Only the indentation changes here: the numbers follow from
 *  `renumberLists`. The first item of a list has nothing to nest under, so Tab does nothing there;
 *  outside a list both keys fall through to plain indentation. */
function moveItems(nest: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const sel = state.selection;
    if (sel.ranges.length > 1) return false;
    const { doc } = state;
    const first = itemOnLine(state, sel.main.from);
    if (!first) return false;
    const target = nest ? first.prevSibling : first.parent?.parent;
    if (target?.name !== 'ListItem') return nest;
    const delta = (nest ? contentColumn(doc, target) : column(doc, target.from)) - column(doc, first.from);
    if (delta === 0 || delta > 0 !== nest) return true;
    const end = Math.max(first.to, itemOnLine(state, sel.main.to)?.to ?? 0, sel.main.to);
    const changes: ChangeSpec[] = [];
    for (let n = doc.lineAt(first.from).number; n <= doc.lineAt(end).number; n++) {
      const line = doc.line(n);
      if (line.text.trim() === '') continue;
      if (nest) changes.push({ from: line.from, insert: ' '.repeat(delta) });
      else changes.push({ from: line.from, to: line.from + Math.min(-delta, /^ */.exec(line.text)![0].length) });
    }
    dispatch(state.update({ changes, scrollIntoView: true, userEvent: 'input.indent' }));
    return true;
  };
}

const numberText = (doc: Text, item: SyntaxNode): string | null => NUMBER.exec(doc.sliceString(item.from, item.from + 12))?.[0] ?? null;

/** Numbers a list's items in sequence: a nested list from 1, an outer list from its first number.
 *  A list whose items all carry the same number (`1.` on every line) is numbered that way on purpose
 *  and left alone. */
function renumber(list: SyntaxNode, doc: Text, changes: ChangeSpec[]): void {
  const items = list.getChildren('ListItem');
  const nums = items.map((it) => numberText(doc, it));
  if (nums.some((n) => n === null) || (items.length > 1 && nums.every((n) => n === nums[0]))) return;
  const start = list.parent?.name === 'ListItem' ? 1 : +nums[0]!;
  items.forEach((it, i) => {
    const want = String(start + i);
    if (nums[i] !== want) changes.push({ from: it.from, to: it.from + nums[i]!.length, insert: want });
  });
}

/** After an edit that adds or removes lines, or nests an item, the ordered lists around each change
 *  are renumbered in the same transaction, so one undo takes back both. Edits inside a line leave
 *  numbers alone: a number the user types is theirs. This is the one place that numbers lists;
 *  reading `tr.state` builds the new state, and a renumbering builds it once more, which only edits
 *  that change lines in an ordered list pay. */
const renumberLists = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('move'))) return tr;
  let lines = tr.isUserEvent('input.indent');
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    lines ||= inserted.lines > 1 || toA > tr.startState.doc.lineAt(fromA).to;
  });
  if (!lines) return tr;
  const state = tr.state;
  const lists = new Map<number, SyntaxNode>();
  // The lists that hold a changed line, and the sublists of a moved item, which a change at its
  // line start does not touch.
  tr.changes.iterChangedRanges((_fA, _tA, fromB, toB) => {
    const to = Math.max(toB, itemOnLine(state, toB)?.to ?? toB);
    syntaxTree(state).iterate({ from: fromB, to, enter: (n) => void (n.name === 'OrderedList' && lists.set(n.from, n.node)) });
  });
  const changes: ChangeSpec[] = [];
  for (const list of lists.values()) renumber(list, state.doc, changes);
  return changes.length ? [tr, { changes, sequential: true }] : tr;
});

export function listExtension(): Extension {
  return [
    renumberLists,
    keymap.of([
      { key: 'Enter', run: enter },
      { key: 'Backspace', run: (v) => clearEmptyItem(v) || deleteMarkupBackward(v) },
      { key: 'Tab', run: moveItems(true), shift: moveItems(false) }
    ])
  ];
}
