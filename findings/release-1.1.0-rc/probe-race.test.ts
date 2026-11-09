// @vitest-environment jsdom
// Probe (review of the 1.1.0 RC): a first save or Save As whose write is still running while the
// user opens the same note from Explorer. Harness copied from src/integration.test.ts. The
// expectations record what the RC does now: a pass means the race gives two tabs on one note.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionFile, TabState } from '../rc/src/types';

vi.mock('../rc/src/editor/search', () => ({ findExtension: () => [], openFind: () => false }));
vi.mock('../rc/src/editor/codeLanguages', () => ({ codeParser: () => null, highlightCode: async () => {}, CODE_LANGUAGES: [] }));
vi.mock('../rc/src/ipc', () => ({
  readNote: vi.fn(),
  writeNote: vi.fn(),
  saveImage: vi.fn(),
  importImage: vi.fn(),
  statNote: vi.fn(),
  resolveAssetPath: vi.fn(() => new Promise(() => {})),
  toAssetUrl: (p: string) => `asset://${p}`,
  claimNewNote: vi.fn(),
  pickSavePath: vi.fn(),
  promoteUntitled: vi.fn(async () => null),
  copyAssets: vi.fn(async () => null),
  saveSessionRaw: vi.fn(async () => {}),
  loadSessionRaw: vi.fn(async () => ({ raw: null, setAside: null })),
  perfMark: vi.fn(async () => false)
}));
vi.mock('../rc/src/infobar', () => ({ showError: vi.fn(), showInfo: vi.fn(), clearInfo: vi.fn(), clearTabInfo: vi.fn() }));
vi.mock('../rc/src/preview/render', () => ({ renderRead: vi.fn(async () => document.createElement('article')) }));
vi.mock('../rc/src/firstSaveBar', () => ({ askFirstSave: vi.fn() }));

import { copyAssets, pickSavePath, readNote, writeNote } from '../rc/src/ipc';
import { askFirstSave } from '../rc/src/firstSaveBar';
import { parseSettings } from '../rc/src/settings';

const note = (text: string, mtimeMs = 1) => ({ text, format: { crlf: false, bom: false }, stamp: { mtimeMs, size: text.length } });
const tab = (o: Partial<TabState>): TabState => ({
  id: 'x', title: 'x', filePath: null, content: '', dirty: false, mode: 'edit', cursor: 0, scrollTop: 0, disk: null, format: null, ...o
});
const session = (tabs: TabState[]): SessionFile => ({
  version: 3, activeTabId: tabs[0].id, lastFolder: null, tabs, closedTabs: [], settings: parseSettings(undefined)
});
const flush = () => new Promise((r) => setTimeout(r, 0));

let tabsMod: typeof import('../rc/src/tabs');
let saving: typeof import('../rc/src/saving');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  tabsMod = await import('../rc/src/tabs');
  saving = await import('../rc/src/saving');
  document.body.innerHTML = '<div id="e"></div><div id="r"></div>';
  tabsMod.initTabs({ editor: document.getElementById('e')!, read: document.getElementById('r')! }, { render: vi.fn() } as never, saving.scheduleAutosave);
  vi.stubGlobal('requestAnimationFrame', () => 0);
});

const onPath = (p: string) => tabsMod.getTabs().filter((t) => t.filePath !== null && t.filePath.toLowerCase() === p.toLowerCase()).map((t) => t.id);

describe('probe: an open that finishes its read before a running save finishes its write', () => {
  it('first save (Other folder, an existing file replaced) and an Explorer open of that file give two tabs', async () => {
    const P = 'C:/n/p.md';
    await tabsMod.restore(session([tab({ id: 'u', title: 'Untitled-1', content: 'mine' })]));
    vi.mocked(askFirstSave).mockResolvedValue('other');
    vi.mocked(pickSavePath).mockResolvedValue(P);
    let release!: () => void;
    vi.mocked(writeNote).mockImplementation(() => new Promise((r) => (release = () => r({ written: { mtimeMs: 9, size: 4 } }))));
    vi.mocked(readNote).mockResolvedValue(note('older file'));
    const save = saving.saveTab('u');
    await flush(); // the save passed refuseHeld and waits on writeNote
    await tabsMod.openPath(P); // double-click in Explorer: the read ends first
    release();
    expect(await save).toBe(true);
    expect(onPath(P)).toHaveLength(2);
  });

  it('Save As to an existing note: an open during copyAssets gives two tabs, and the second tab holds a stale stamp', async () => {
    const A = 'C:/n/a.md';
    const Q = 'C:/n/q.md';
    vi.mocked(readNote).mockImplementation(async (p) => (p === A ? note('a text') : note('q text', 1)));
    await tabsMod.restore(session([tab({ id: 'a', title: 'a.md', filePath: A })]));
    vi.mocked(pickSavePath).mockResolvedValue(Q);
    let copied!: () => void;
    vi.mocked(copyAssets).mockImplementation(() => new Promise((r) => (copied = () => r(null))));
    vi.mocked(writeNote).mockResolvedValue({ written: { mtimeMs: 7, size: 6 } });
    const saveAs = saving.saveAs('a');
    await flush(); // refuseHeld passed; the image copy runs
    await tabsMod.openPath(Q);
    copied();
    expect(await saveAs).toBe(true);
    expect(onPath(Q)).toHaveLength(2);
    expect(vi.mocked(writeNote).mock.calls.at(-1)![3]).toBeNull(); // the Save As write checks nothing
    const other = tabsMod.getTabs().find((t) => t.id !== 'a' && t.filePath === Q)!;
    expect(other.disk).toEqual({ mtimeMs: 1, size: 6 }); // the stamp of the file the Save As replaced
  });
});
