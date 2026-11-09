// @vitest-environment jsdom
// Probe (review of the 1.1.0 RC): a closed dirty tab whose write is refused is not put in conflict,
// so every later flush (window blur, close) sends the same refused write again. A pass records that.
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

describe("probe: a refused write of a closed tab", () => {
  it("is sent again on every flush and never puts the tab in conflict", async () => {
    const P = "C:/n/c.md";
    await tabsMod.restore(session([tab({ id: "c", title: "c.md", filePath: P, dirty: true, content: "unsaved", disk: { mtimeMs: 1, size: 3 } }), tab({ id: "k", content: "k" })]));
    await tabsMod.closeTab("c");
    vi.mocked(writeNote).mockResolvedValue({ changed: { mtimeMs: 5, size: 5 } }); // a new note at the path, saved by another tab
    await saving.flushDirty();
    await saving.flushDirty();
    await saving.flushDirty();
    expect(vi.mocked(writeNote)).toHaveBeenCalledTimes(3);
    expect((await import("../rc/src/diskState")).inConflict("c")).toBe(false);
  });
});
