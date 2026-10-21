// The startup order in app.ts: what must be in place before a file from the command line or Finder is read.
import { expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  order: [] as string[],
  onCloseRequested: vi.fn(async () => {}),
  onForwardedFiles: vi.fn(async () => {}),
  onFilesDropped: vi.fn(async () => {}),
  onQuitRequested: vi.fn(async () => {}),
  onOpenedNotes: vi.fn(async () => {}),
  onMenuCommand: vi.fn(async () => {}),
  onPasteText: vi.fn(async () => {}),
  loadSession: vi.fn(async (): Promise<{ session: unknown; setAside: string | null }> => ({
    session: { version: 3, activeTabId: '', untitledCounter: 1, lastFolder: null, tabs: [], closedTabs: [] },
    setAside: null
  })),
  showError: vi.fn(),
  showInfo: vi.fn()
}));
vi.mock('./ipc', () => ({
  getCliStartupFiles: async () => ['C:/n/hung.md'],
  onCloseRequested: m.onCloseRequested,
  onForwardedFiles: m.onForwardedFiles,
  onFilesDropped: m.onFilesDropped,
  onQuitRequested: m.onQuitRequested,
  onOpenedNotes: m.onOpenedNotes,
  onMenuCommand: m.onMenuCommand,
  onPasteText: m.onPasteText,
  pickFileToOpen: async () => null,
  takeOpenedNotes: async () => ['/Users/x/hung.md'],
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
vi.mock('./session', () => ({ loadSession: m.loadSession }));
vi.mock('./external', () => ({ startExternalWatch: () => void m.order.push('watch') }));
vi.mock('./perf', () => ({ markReady: () => {}, markStep: () => {} }));
vi.mock('./drop', () => ({ handleDrop: async () => {} }));
vi.mock('./infobar', () => ({ mountInfobar: () => {}, focusInfobar: () => false, showError: m.showError, showInfo: m.showInfo }));
vi.mock('./titlebar', () => ({ Titlebar: class {} }));
vi.mock('./closedTabs', () => ({ closeTabWithRestore: async () => {}, restoreClosedTab: async () => {} }));

import { startApp } from './app';

it('a hung read of a command-line or Finder file leaves session writes, the close and quit flush, forwarded files, Finder, the menu and drops working', async () => {
  void startApp(document.createElement('div'));
  await new Promise((r) => setTimeout(r, 20));
  expect(m.order).toEqual(['restore', 'session writes', 'watch']);
  expect(m.onCloseRequested).toHaveBeenCalled();
  expect(m.onForwardedFiles).toHaveBeenCalled();
  expect(m.onFilesDropped).toHaveBeenCalled();
  expect(m.onQuitRequested).toHaveBeenCalled();
  expect(m.onOpenedNotes).toHaveBeenCalled();
  expect(m.onMenuCommand).toHaveBeenCalled();
  expect(m.onPasteText).toHaveBeenCalled();
});

it('a session that could not be read or kept aside is not overwritten: no session writes, and a lasting error', async () => {
  m.order.length = 0;
  m.loadSession.mockRejectedValueOnce('session.json cannot be read (locked) and could not be kept aside');
  void startApp(document.createElement('div'));
  await new Promise((r) => setTimeout(r, 20));
  expect(m.order).not.toContain('session writes');
  expect(m.showError).toHaveBeenCalledWith(expect.stringContaining('session'), expect.anything(), 'session');
});

it('a session that was set aside is named in a lasting bar, and the new session is written', async () => {
  m.order.length = 0;
  m.loadSession.mockResolvedValueOnce({ session: null, setAside: 'C:/data/session.unreadable-1.json' });
  void startApp(document.createElement('div'));
  await new Promise((r) => setTimeout(r, 20));
  expect(m.order).toContain('session writes');
  expect(m.showInfo).toHaveBeenCalledWith(expect.objectContaining({ key: 'session-aside', text: expect.stringContaining('session.unreadable-1.json') }));
});
