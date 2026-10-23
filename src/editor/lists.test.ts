import { afterEach, describe, expect, it } from 'vitest';
import { EditorSelection, EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, runScopeHandlers } from '@codemirror/view';
import { defaultKeymap, indentWithTab, undo, history, historyKeymap } from '@codemirror/commands';
import { markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { listExtension } from './lists';

let view: EditorView | null = null;

/** A view with the editor's keymaps; `|` in `doc` marks the cursor. */
function make(doc: string): EditorView {
  const at = Math.max(0, doc.indexOf('|'));
  const parent = document.createElement('div');
  document.body.append(parent);
  view = new EditorView({
    state: EditorState.create({
      doc: doc.replace('|', ''),
      selection: EditorSelection.cursor(at),
      extensions: [markdownLanguage, history(), Prec.high(listExtension()), keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab])]
    }),
    parent
  });
  return view;
}

/** Presses a key (after the parser has caught up) and returns the text with `|` at the cursor. */
function press(v: EditorView, key: string, shiftKey = false): string {
  ensureSyntaxTree(v.state, v.state.doc.length, 1e9);
  runScopeHandlers(v, new KeyboardEvent('keydown', { key, shiftKey }), 'editor');
  return shown(v);
}

function type(v: EditorView, text: string): void {
  const at = v.state.selection.main.head;
  v.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, userEvent: 'input.type' });
}

const shown = (v: EditorView): string => {
  const doc = v.state.doc.toString();
  const at = v.state.selection.main.head;
  return doc.slice(0, at) + '|' + doc.slice(at);
};

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe('Enter in quotes and lists', () => {
  it('Enter on an empty quote line ends the quote with a blank line', () => {
    const v = make('> een citaat|');
    expect(press(v, 'Enter')).toBe('> een citaat\n> |');
    expect(press(v, 'Enter')).toBe('> een citaat\n\n|');
  });

  it('Enter on an empty last item ends the list with a blank line', () => {
    const v = make('- een\n- |');
    expect(press(v, 'Enter')).toBe('- een\n\n|');
  });

  it('Enter on an empty item with items below leaves the ending to CodeMirror', () => {
    const v = make('- een\n- |\n- drie');
    expect(press(v, 'Enter')).not.toContain('\n\n|');
  });

  it('Enter on an empty nested item moves it up a level, without a blank line', () => {
    const v = make('- item een\n- item twee\n  - genest item|');
    expect(press(v, 'Enter')).toBe('- item een\n- item twee\n  - genest item\n  - |');
    expect(press(v, 'Enter')).toBe('- item een\n- item twee\n  - genest item\n- |');
  });

  it('Enter inside a fenced code block adds no markup', () => {
    const v = make('```\n> |\n```');
    expect(press(v, 'Enter')).toBe('```\n> \n|\n```');
  });
});

describe('Backspace on an empty item', () => {
  it('clears the whole line, so the next Backspace joins the previous line', () => {
    const v = make('1. een\n2. twee\n3. |\n4. vier');
    expect(press(v, 'Backspace')).toBe('1. een\n2. twee\n|\n4. vier');
    expect(press(v, 'Backspace')).toBe('1. een\n2. twee|\n3. vier');
  });

  it('clears a nested empty item with its indentation', () => {
    const v = make('6. vijf\n   1. |');
    expect(press(v, 'Backspace')).toBe('6. vijf\n|');
  });
});

describe('Tab and Shift+Tab on list items', () => {
  it('nests an ordered item under the one above, indented to its text and starting at 1', () => {
    const v = make('5. vijf\n6. |');
    expect(press(v, 'Tab')).toBe('5. vijf\n   1. |');
  });

  it('indents to the width of a wider marker', () => {
    const v = make('10. tien\n11. elf|');
    expect(press(v, 'Tab')).toBe('10. tien\n    1. elf|');
  });

  it('builds the sublist from the tester report and continues the outer list after Shift+Tab', () => {
    const v = make('5. vier\n6. vijf|');
    press(v, 'Enter');
    press(v, 'Tab');
    type(v, 'sub a');
    press(v, 'Enter');
    type(v, 'sub b');
    press(v, 'Enter');
    expect(press(v, 'Tab', true)).toBe('5. vier\n6. vijf\n   1. sub a\n   2. sub b\n7. |');
  });

  it('continues a sublist that is already there', () => {
    const v = make('1. een\n   1. sub\n2. |twee');
    expect(press(v, 'Tab')).toBe('1. een\n   1. sub\n   2. |twee');
  });

  it('renumbers the outer list when an item moves into a sublist', () => {
    const v = make('1. een\n2. |twee\n3. drie');
    expect(press(v, 'Tab')).toBe('1. een\n   1. |twee\n2. drie');
  });

  it('moves a nested item and its own sublist together', () => {
    const v = make('- a\n- |b\n  - c');
    expect(press(v, 'Tab')).toBe('- a\n  - |b\n    - c');
  });

  it('leaves the first item where it is', () => {
    const v = make('1. |een\n2. twee');
    expect(press(v, 'Tab')).toBe('1. |een\n2. twee');
  });

  it('indents normally outside a list', () => {
    const v = make('tekst|');
    expect(press(v, 'Tab')).not.toBe('tekst|');
  });
});

describe('renumbering after an edit', () => {
  it('renumbers after a whole line is deleted, in one undo step', () => {
    const v = make('1. een\n2. twee\n3. drie\n4. vier\n5. vijf');
    const line = v.state.doc.line(3);
    v.dispatch({ changes: { from: line.from, to: line.to + 1 }, userEvent: 'delete.selection' });
    expect(v.state.doc.toString()).toBe('1. een\n2. twee\n3. vier\n4. vijf');
    undo(v);
    expect(v.state.doc.toString()).toBe('1. een\n2. twee\n3. drie\n4. vier\n5. vijf');
  });

  it('keeps the first number of a list that starts elsewhere', () => {
    const v = make('5. vijf\n6. zes\n7. zeven');
    const line = v.state.doc.line(2);
    v.dispatch({ changes: { from: line.from, to: line.to + 1 }, userEvent: 'delete.selection' });
    expect(v.state.doc.toString()).toBe('5. vijf\n6. zeven');
  });

  it('leaves a list numbered 1. on every line alone', () => {
    const v = make('1. een\n1. twee\n1. drie');
    const line = v.state.doc.line(2);
    v.dispatch({ changes: { from: line.from, to: line.to + 1 }, userEvent: 'delete.selection' });
    expect(v.state.doc.toString()).toBe('1. een\n1. drie');
  });

  it('leaves a number the user types inside a line', () => {
    const v = make('1. een\n|2. twee');
    v.dispatch({ changes: { from: v.state.selection.main.head, to: v.state.selection.main.head + 1, insert: '7' }, userEvent: 'input.type' });
    expect(v.state.doc.toString()).toBe('1. een\n7. twee');
  });

  it('does not touch lists on undo', () => {
    const v = make('1. een\n3. drie');
    v.dispatch({ changes: { from: 0, insert: 'x' }, userEvent: 'undo' });
    expect(v.state.doc.toString()).toBe('x1. een\n3. drie');
  });
});
