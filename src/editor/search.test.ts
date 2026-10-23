import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SearchQuery, setSearchQuery } from '@codemirror/search';
import { initSettings } from '../settings';
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

  it('the panel fields turn off macOS autocorrection, capitals and spelling', () => {
    const v = make('text');
    openFind(v, false);
    for (const name of ['search', 'replace']) {
      expect(field(v, name).getAttribute('autocorrect')).toBe('off');
      expect(field(v, name).getAttribute('autocapitalize')).toBe('off');
      expect(field(v, name).spellcheck).toBe(false);
    }
  });

  it('a click on a panel button keeps the focus where it is, a click in a field does not', () => {
    const v = make('text');
    openFind(v, false);
    const press = (el: Element) => {
      const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(press(v.dom.querySelector('.cm-search button[name=replaceAll]')!)).toBe(true);
    expect(press(v.dom.querySelector('.cm-search input[type=checkbox]')!)).toBe(true);
    expect(press(field(v, 'replace'))).toBe(false);
  });
});

describe('match count', () => {
  const count = (v: EditorView) => v.dom.querySelector('.cm-search-count');
  const query = (v: EditorView, search: string, regexp = false) => {
    v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search, regexp })) });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    initSettings({ lineBreaks: false, taskClicks: true, copyCode: true, findCount: true }, () => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('appears after idle, not synchronously, after the find field', () => {
    const v = make('a b a');
    openFind(v, false);
    query(v, 'a');
    expect(count(v)!.textContent).toBe('');
    expect(count(v)!.previousElementSibling).toBe(field(v, 'search'));
    expect(count(v)!.getAttribute('aria-live')).toBe('polite');
    vi.advanceTimersByTime(200);
    expect(count(v)!.textContent).toBe('2 matches');
  });

  it('says 2 of 3 when the second match is selected', () => {
    const v = make('x x x', 2, 3);
    openFind(v, false);
    query(v, 'x');
    vi.advanceTimersByTime(200);
    expect(count(v)!.textContent).toBe('2 of 3');
  });

  it('says No matches, and nothing for an empty or invalid query', () => {
    const v = make('abc');
    openFind(v, false);
    query(v, 'zzz');
    vi.advanceTimersByTime(200);
    expect(count(v)!.textContent).toBe('No matches');
    query(v, '(', true);
    vi.advanceTimersByTime(200);
    expect(count(v)!.textContent).toBe('');
  });

  it('stops at 1000+', () => {
    const v = make('a'.repeat(1500));
    openFind(v, false);
    query(v, 'a');
    vi.advanceTimersByTime(200);
    expect(count(v)!.textContent).toBe('1000+ matches');
    v.dispatch({ selection: { anchor: 0, head: 1 } });
    vi.advanceTimersByTime(200);
    expect(count(v)!.textContent).toBe('1 of 1000+');
  });

  it('runs one count for several changes', () => {
    const v = make('a a');
    const spy = vi.spyOn(globalThis, 'setTimeout');
    openFind(v, false);
    query(v, 'a');
    v.dispatch({ selection: { anchor: 0, head: 1 } });
    v.dispatch({ changes: { from: 0, insert: 'a' } });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('adds no span when the setting is off', () => {
    initSettings({ lineBreaks: false, taskClicks: true, copyCode: true, findCount: false }, () => {});
    const v = make('a');
    openFind(v, false);
    query(v, 'a');
    vi.advanceTimersByTime(200);
    expect(count(v)).toBeNull();
  });
});
