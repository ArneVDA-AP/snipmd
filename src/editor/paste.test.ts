// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorView } from '@codemirror/view';

vi.mock('../ipc', () => ({ saveImage: vi.fn() }));
vi.mock('../perf', () => ({ markPasteVisible: vi.fn() }));
vi.mock('../session', () => ({ scheduleSessionSave: vi.fn() }));
vi.mock('../infobar', () => ({ showError: vi.fn() }));
vi.mock('./imageWidget', () => ({ primeAssetCache: vi.fn(), imageWidgetField: [] }));

import { saveImage } from '../ipc';
import { showError } from '../infobar';
import { scheduleSessionSave } from '../session';
import { createEditorState } from './setup';
import { pastePlainText, placeImages } from './paste';
import { applyToTab, getState, initRegistry, setState, setView } from './registry';
import { primeAssetCache } from './imageWidget';
import { markPasteVisible } from '../perf';

initRegistry({ filePathOf: () => null, onChange: () => {} });

Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

const mockSave = vi.mocked(saveImage);
let view: EditorView;

function mount(doc: string, cursor = doc.length): void {
  view = new EditorView({ state: createEditorState('a', doc).update({ selection: { anchor: cursor } }).state });
  document.body.appendChild(view.dom);
  setView(view);
}

function file(): File {
  const f = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new Uint8Array([1, 2, 3]).buffer });
  return f;
}

/** A clipboard like WebView2's: the text item comes first, an image item after it. */
function paste(text: string, withImage: boolean, extraItems: { type: string; getAsFile: () => File | null }[] = []): Event {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  const items = [{ type: 'text/plain', getAsFile: () => null }, ...(withImage ? [{ type: 'image/png', getAsFile: file }] : []), ...extraItems];
  Object.defineProperty(ev, 'clipboardData', { value: { getData: (t: string) => (t === 'text/plain' ? text : ''), items } });
  view.contentDOM.dispatchEvent(ev);
  return ev;
}
const keydown = (init: KeyboardEventInit) => view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

const img = (link: string) => ({ link, absPath: `/abs/${link}` });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  mockSave.mockResolvedValue({ link: 'a.assets/s.png', absPath: '/n/a.assets/s.png' });
});

describe('paste rules', () => {
  it('text plus image pastes the text and never saves', async () => {
    mount('');
    paste('hello', true);
    await flush();
    expect(mockSave).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe('hello'); // CodeMirror's own paste handled it
  });

  it('image only saves once and links on its own line, cursor on the next line', async () => {
    mount('abc', 1);
    const ev = paste('', true);
    expect(ev.defaultPrevented).toBe(true);
    await flush();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith('a', null, new Uint8Array([1, 2, 3]));
    expect(view.state.doc.toString()).toBe('abc\n![snip](a.assets/s.png)\n');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
    expect(primeAssetCache).toHaveBeenCalledWith('a', 'a.assets/s.png', '/n/a.assets/s.png');
    expect(markPasteVisible).toHaveBeenCalledWith('/n/a.assets/s.png', ev.timeStamp);
    expect(showError).not.toHaveBeenCalled();
  });

  it('a clipboard with neither text nor an image is left to CodeMirror', async () => {
    mount('x');
    paste('', false, [{ type: 'text/html', getAsFile: () => null }]);
    await flush();
    expect(view.state.doc.toString()).toBe('x');
    expect(mockSave).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalled();
  });

  it('a failed image save is reported and leaves the note as it was', async () => {
    mount('x');
    mockSave.mockRejectedValue(new Error('disk full'));
    paste('', true);
    await flush();
    expect(showError).toHaveBeenCalledWith('save the image', expect.any(Error));
    expect(view.state.doc.toString()).toBe('x');
    expect(scheduleSessionSave).not.toHaveBeenCalled();
  });

  it('other keys with Shift or Ctrl do not turn the next paste into a plain one', async () => {
    mount('');
    keydown({ key: 'V', code: 'KeyV', shiftKey: true }); // typing a capital V
    paste('', true);
    keydown({ key: 'T', code: 'KeyT', ctrlKey: true, shiftKey: true });
    paste('', true);
    keydown({ key: 'v', code: 'KeyV', ctrlKey: true });
    paste('', true);
    await flush();
    expect(mockSave).toHaveBeenCalledTimes(3);
  });

  it('the key watcher swallows no key: typing and shortcuts still reach the editor', () => {
    mount('');
    for (const init of [{ key: 'a', code: 'KeyA' }, { key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true }]) {
      const ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      view.contentDOM.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    }
  });

  it('Ctrl+Shift+V with only an image saves nothing', async () => {
    mount('');
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true, bubbles: true }));
    paste('', true);
    await flush();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('a later paste after another key saves again', async () => {
    mount('');
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', code: 'KeyV', ctrlKey: true, shiftKey: true, bubbles: true }));
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    paste('', true);
    await flush();
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('a tab switch during the save inserts into the original tab', async () => {
    mount('one');
    let resolve!: (v: { link: string; absPath: string }) => void;
    mockSave.mockReturnValue(new Promise((r) => (resolve = r)));
    paste('', true);
    await flush();
    const other = createEditorState('b', 'other');
    setState('a', view.state);
    view.setState(other);
    resolve({ link: 'a.assets/s.png', absPath: '/x' });
    await flush();
    expect(view.state.doc.toString()).toBe('other');
    expect(getState('a')?.doc.toString()).toBe('one\n![snip](a.assets/s.png)\n');
    expect(showError).not.toHaveBeenCalled();
  });
});

describe('placeImages', () => {
  it('mid-line keeps the line text, puts the link below and the cursor on a new empty line', () => {
    mount('hello\nworld', 2);
    placeImages('a', [img('l.png')]);
    expect(view.state.doc.toString()).toBe('hello\n![snip](l.png)\n\nworld');
    expect(view.state.selection.main.head).toBe('hello\n![snip](l.png)\n'.length);
    expect(scheduleSessionSave).toHaveBeenCalledWith({ immediate: true }); // SPEC §7: right after a paste
    expect(primeAssetCache).toHaveBeenCalledWith('a', 'l.png', '/abs/l.png');
  });

  it('a tab that is gone takes nothing and throws nothing', () => {
    mount('A');
    expect(() => placeImages('nope', [img('l.png')])).not.toThrow();
    expect(view.state.doc.toString()).toBe('A');
    expect(scheduleSessionSave).toHaveBeenCalledWith({ immediate: true });
  });

  it('applyToTab reports whether the tab had a document', () => {
    mount('A');
    expect(applyToTab('a', { changes: { from: 1, insert: 'B' } })).toBe(true);
    expect(view.state.doc.toString()).toBe('AB');
    expect(applyToTab('nope', { changes: { from: 0, insert: 'x' } })).toBe(false);
  });

  it('an empty line takes the link and the cursor stays on an empty line before the next text', () => {
    mount('a\n\nb', 2);
    placeImages('a', [img('l.png')]);
    expect(view.state.doc.toString()).toBe('a\n![snip](l.png)\n\nb');
    expect(view.state.selection.main.head).toBe('a\n![snip](l.png)\n'.length);
  });

  it('last line without a line break gets one', () => {
    mount('end');
    placeImages('a', [img('l.png')]);
    expect(view.state.doc.toString()).toBe('end\n![snip](l.png)\n');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('at on another line wins over the cursor', () => {
    mount('one\ntwo\nthree', 0);
    placeImages('a', [img('l.png')], 5);
    expect(view.state.doc.toString()).toBe('one\ntwo\n![snip](l.png)\n\nthree');
  });

  it('several images go in one block, in order, with no user text between them', () => {
    mount('A\nB\nC', 0);
    placeImages('a', [img('one.png'), img('two.png')], 0);
    expect(view.state.doc.toString()).toBe('A\n![snip](one.png)\n![snip](two.png)\n\nB\nC');
    expect(view.state.selection.main.head).toBe('A\n![snip](one.png)\n![snip](two.png)\n'.length);
  });

  it('an empty next line is used, not doubled', () => {
    mount('A\n\nB', 0);
    placeImages('a', [img('l.png')]);
    expect(view.state.doc.toString()).toBe('A\n![snip](l.png)\n\nB');
    expect(view.state.selection.main.head).toBe('A\n![snip](l.png)\n'.length);
  });

  it('nothing to place changes nothing and saves nothing', () => {
    mount('A');
    placeImages('a', []);
    expect(view.state.doc.toString()).toBe('A');
    expect(scheduleSessionSave).not.toHaveBeenCalled();
  });
});

describe('Paste as Plain Text from the macOS menu (SPEC §13)', () => {
  it('replaces the selection in the focused note, with line breaks normalized', () => {
    mount('ab', 1);
    view.dispatch({ selection: { anchor: 1, head: 2 } });
    view.contentDOM.focus();
    pastePlainText(view, 'x\r\ny');
    expect(view.state.doc.toString()).toBe('ax\ny');
    expect(view.state.selection.main.head).toBe(4);
  });

  it('does nothing when the note does not have focus (read mode, the tab strip)', () => {
    mount('ab');
    view.contentDOM.blur();
    pastePlainText(view, 'x');
    expect(view.state.doc.toString()).toBe('ab');
  });
});
