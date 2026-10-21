import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { findExtension, openFind } from './search';

let view: EditorView | null = null;

function make(doc: string, anchor = 0, head = anchor): EditorView {
  const parent = document.createElement('div');
  document.body.append(parent);
  view = new EditorView({
    state: EditorState.create({ doc, selection: { anchor, head }, extensions: [findExtension()] }),
    parent
  });
  return view;
}

const field = (v: EditorView, name: string) => v.dom.querySelector<HTMLInputElement>(`.cm-search input[name=${name}]`)!;

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.replaceChildren();
});

describe('find and replace panel', () => {
  it('Ctrl+H with nothing to find starts in the find field', () => {
    const v = make('scope is inactive');
    openFind(v, true);
    expect(document.activeElement).toBe(field(v, 'search'));
  });

  it('Ctrl+H with a selected term goes to the replace field', () => {
    const v = make('scope is inactive', 0, 5);
    openFind(v, true);
    expect(field(v, 'search').value).toBe('scope');
    expect(document.activeElement).toBe(field(v, 'replace'));
  });

  it('the panel fields turn off WebView2 autofill', () => {
    const v = make('text');
    openFind(v, false);
    const inputs = [...v.dom.querySelectorAll<HTMLInputElement>('.cm-search input')];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input.getAttribute('autocomplete')).toBe('off');
  });
});
