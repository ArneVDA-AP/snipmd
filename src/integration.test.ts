// Tabs, the editor registry, paste and saving run for real here; only the Rust side (ipc), the
// info bar and read mode are stubbed. The module tests stub their neighbours, so this file is where
// the seams between them are checked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionFile, TabState } from './types';

vi.mock('./ipc', () => ({
  readNote: vi.fn(),
  writeNote: vi.fn(),
  saveImage: vi.fn(),
  importImage: vi.fn(),
  statNote: vi.fn(),
  resolveAssetPath: vi.fn(() => new Promise(() => {})),
  toAssetUrl: (p: string) => `asset://${p}`,
  saveSessionRaw: vi.fn(async () => {}),
  loadSessionRaw: vi.fn(async () => null),
  perfMark: vi.fn(async () => false)
}));
vi.mock('./infobar', () => ({ showError: vi.fn(), showInfo: vi.fn(), clearInfo: vi.fn(), clearTabInfo: vi.fn() }));
vi.mock('./preview/render', () => ({ renderRead: vi.fn() }));

import { readNote, saveImage, writeNote } from './ipc';
import { showError } from './infobar';
import { closeTab, getTab, initTabs, reopenClosed, restore, textOf } from './tabs';
import { flushDirty, scheduleAutosave } from './saving';
import { getView } from './editor/registry';

const note = (text: string) => ({ text, format: { crlf: false, bom: false }, stamp: { mtimeMs: 1, size: text.length } });
const tab = (o: Partial<TabState>): TabState => ({
  id: 'x', title: 'x', filePath: null, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: null, format: null, ...o
});
const session = (tabs: TabState[]): SessionFile => ({
  version: 3, activeTabId: tabs[0].id, untitledCounter: 1, lastFolder: null, tabs, closedTabs: []
});
const flush = () => new Promise((r) => setTimeout(r, 0));

/** Pastes an image whose bytes arrive only when the returned function is called. */
function pasteImageLater(): () => void {
  let release!: () => void;
  const bytes = new Promise<ArrayBuffer>((r) => (release = () => r(new ArrayBuffer(4))));
  const file = { type: 'image/png', arrayBuffer: () => bytes };
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', {
    value: { getData: () => '', items: [{ type: 'image/png', getAsFile: () => file }] }
  });
  getView()!.contentDOM.dispatchEvent(ev);
  return release;
}

let n = 0;
beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="e"></div><div id="r"></div>';
  initTabs({ editor: document.getElementById('e')!, read: document.getElementById('r')! }, { render: vi.fn() } as never, scheduleAutosave);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.mocked(writeNote).mockImplementation(async (_p, text) => ({ written: { mtimeMs: 2, size: text.length } }));
  n++;
});

describe('paste, close and save together', () => {
  it('a screenshot pasted just before Ctrl+W on a saved note goes next to the note and is written to it', async () => {
    const id = `p${n}`;
    vi.mocked(readNote).mockResolvedValue(note('note'));
    vi.mocked(saveImage).mockResolvedValue({ link: 'n.assets/s.png', absPath: 'C:/n/n.assets/s.png' });
    await restore(session([tab({ id, title: 'n.md', filePath: 'C:/n/n.md' }), tab({ id: `q${n}`, content: 'other' })]));

    const release = pasteImageLater();
    await closeTab(id);
    release();
    await flush();
    await flush();

    expect(saveImage).toHaveBeenCalledWith(id, 'C:/n/n.md', expect.any(Uint8Array));
    const closed = getTab(id)!;
    expect(textOf(closed)).toContain('![snip](n.assets/s.png)');
    expect(textOf(closed)).not.toContain('untitled.assets');

    await flushDirty();
    expect(writeNote).toHaveBeenCalledWith('C:/n/n.md', expect.stringContaining('n.assets/s.png'), expect.anything(), expect.anything());
    expect(getTab(id)!.dirty).toBe(false);
    expect(showError).not.toHaveBeenCalled();
  });

  it('a closed tab with its late screenshot comes back with Ctrl+Shift+T', async () => {
    const id = `u${n}`;
    vi.mocked(saveImage).mockResolvedValue({ link: 'untitled.assets/s.png', absPath: 'C:/scratch/s.png' });
    await restore(session([tab({ id, content: 'draft' }), tab({ id: `v${n}`, content: 'other' })]));

    const release = pasteImageLater();
    await closeTab(id);
    release();
    await flush();
    await flush();

    expect(saveImage).toHaveBeenCalledWith(id, null, expect.any(Uint8Array));
    const back = await reopenClosed(id);
    expect(back?.id).toBe(id);
    expect(textOf(back!)).toContain('![snip](untitled.assets/s.png)');
  });
});
