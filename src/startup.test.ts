// The startup order in app.ts: what must be in place before a file from the command line is read.
import { expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  order: [] as string[],
  onCloseRequested: vi.fn(async () => {}),
  onForwardedFiles: vi.fn(async () => {}),
  onFilesDropped: vi.fn(async () => {})
}));
vi.mock('./ipc', () => ({
  getCliStartupFiles: async () => ['C:/n/hung.md'],
  onCloseRequested: m.onCloseRequested,
  onForwardedFiles: m.onForwardedFiles,
  onFilesDropped: m.onFilesDropped,
  windowBackdrop: async () => false
}));
vi.mock('./tabs', () => ({
  activate: async () => {},
  cycle: async () => {},
  focusActive: () => {},
  getActiveTab: () => undefined,
  getTabs: () => [],
  initTabs: () => {},
  newUntitled: async () => {},
  openPath: async () => {},
  openPaths: () => new Promise(() => {}), // a read that never ends
  preloadReader: () => {},
  restore: async () => void m.order.push('restore'),
  startSessionWrites: () => void m.order.push('session writes'),
  toggleMode: async () => {}
}));
vi.mock('./saving', () => ({ flushDirty: async () => {}, saveAs: async () => {}, saveTab: async () => true, scheduleAutosave: () => {} }));
vi.mock('./session', () => ({ loadSession: async () => ({ version: 3, activeTabId: '', untitledCounter: 1, lastFolder: null, tabs: [], closedTabs: [] }) }));
vi.mock('./external', () => ({ startExternalWatch: () => void m.order.push('watch') }));
vi.mock('./perf', () => ({ markReady: () => {}, markStep: () => {} }));
vi.mock('./drop', () => ({ handleDrop: async () => {} }));
vi.mock('./infobar', () => ({ mountInfobar: () => {}, focusInfobar: () => false }));
vi.mock('./titlebar', () => ({ Titlebar: class {} }));
vi.mock('./closedTabs', () => ({ closeTabWithRestore: async () => {}, restoreClosedTab: async () => {} }));

import { startApp } from './app';

it('a hung read of a command-line file leaves session writes, the close flush, forwarded files and drops working', async () => {
  void startApp(document.createElement('div'));
  await new Promise((r) => setTimeout(r, 20));
  expect(m.order).toEqual(['restore', 'session writes', 'watch']);
  expect(m.onCloseRequested).toHaveBeenCalled();
  expect(m.onForwardedFiles).toHaveBeenCalled();
  expect(m.onFilesDropped).toHaveBeenCalled();
});
