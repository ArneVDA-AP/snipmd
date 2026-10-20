// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorView } from '@codemirror/view';

vi.mock('../ipc', () => ({ saveImage: vi.fn() }));
vi.mock('../session', () => ({ scheduleSessionSave: vi.fn() }));
vi.mock('../infobar', () => ({ showError: vi.fn() }));
vi.mock('./imageWidget', () => ({ primeAssetCache: vi.fn(), imageWidgetField: [] }));

import { saveImage } from '../ipc';
import { showError } from '../infobar';
import { createEditorState } from './setup';
import { insertSnip } from './paste';
import { getState, setState, setView } from './registry';

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

function paste(text: string, withImage: boolean): void {
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  const items = withImage ? [{ type: 'image/png', getAsFile: file }] : [{ type: 'text/plain', getAsFile: () => null }];
  Object.defineProperty(ev, 'clipboardData', { value: { getData: () => text, items } });
  view.contentDOM.dispatchEvent(ev);
}

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
  });

  it('image only saves once and links on its own line, cursor on the next line', async () => {
    mount('abc', 1);
    paste('', true);
    await flush();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(view.state.doc.toString()).toBe('abc\n![snip](a.assets/s.png)\n');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('Ctrl+Shift+V with only an image saves nothing', async () => {
    mount('');
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true }));
    paste('', true);
    await flush();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('a later paste after another key saves again', async () => {
    mount('');
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true }));
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

describe('insertSnip', () => {
  it('mid-line keeps the line text and puts the link below', () => {
    mount('hello\nworld', 2);
    insertSnip('a', 'l.png');
    expect(view.state.doc.toString()).toBe('hello\n![snip](l.png)\nworld');
    expect(view.state.selection.main.head).toBe('hello\n![snip](l.png)\n'.length);
  });

  it('an empty line takes the link', () => {
    mount('a\n\nb', 2);
    insertSnip('a', 'l.png');
    expect(view.state.doc.toString()).toBe('a\n![snip](l.png)\nb');
    expect(view.state.selection.main.head).toBe('a\n![snip](l.png)\n'.length);
  });

  it('last line without a line break gets one', () => {
    mount('end');
    insertSnip('a', 'l.png');
    expect(view.state.doc.toString()).toBe('end\n![snip](l.png)\n');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('at on another line wins over the cursor', () => {
    mount('one\ntwo\nthree', 0);
    insertSnip('a', 'l.png', 5);
    expect(view.state.doc.toString()).toBe('one\ntwo\n![snip](l.png)\nthree');
  });
});
